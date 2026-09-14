import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or } from 'drizzle-orm';
import {
  type CaseEvent,
  type CaseMessage,
  type CaseStatus,
  type CaseSummary,
  type CreateCaseInput,
  type CustomerCaseDetail,
  deriveSubject,
  formatCaseReference,
  OPEN_CASE_STATUSES,
  type PostMessageInput,
  type ResolutionReason,
  type ResolveCaseInput,
  type StaffCaseDetail,
  type StaffQueueView,
  type StaffStatusTarget,
} from '@orbit-support/shared';
import { AttachmentsService, toAttachment } from '../attachments/attachments.service.js';
import { type Db, isUniqueViolation } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { CaseEventBus } from '../events/case-event-bus.js';
import {
  type CaseEventRow,
  caseEvents,
  type CaseMessageRow,
  caseMessages,
  type SupportCaseRow,
  supportCases,
} from '../database/schema.js';
import type { CustomerActor, StaffActor } from '../identity/identity.types.js';

const OPEN = [...OPEN_CASE_STATUSES];

/**
 * Case domain (PH-1 scope): creation, conversation, queue, take, reply. Lifecycle beyond the simple
 * §7.2 reactivation rule, transfers, notes and follow-ups arrive in PH-3 — see docs/phases/PH-1.2.md gaps.
 */
@Injectable()
export class CasesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly events: CaseEventBus,
    private readonly attachments: AttachmentsService,
  ) {}

  // ---------- Customer ----------

  async createCase(customer: CustomerActor, input: CreateCaseInput): Promise<CustomerCaseDetail> {
    if (input.clientMessageId) {
      const existing = await this.findCaseByClientMessage(customer.id, input.clientMessageId);
      if (existing) return this.customerDetail(existing);
    }
    try {
      const { row, message } = await this.db.transaction(async (tx) => {
        const now = new Date();
        const [created] = await tx
          .insert(supportCases)
          .values({
            customerId: customer.id,
            subject: input.subject ?? deriveSubject(input.message),
            category: input.category,
            createdAt: now,
            updatedAt: now,
            lastMessageAt: now,
            lastCustomerMessageAt: now,
          })
          .returning();
        const [first] = await tx
          .insert(caseMessages)
          .values({
            caseId: created.id,
            authorType: 'customer',
            authorId: customer.id,
            body: input.message,
            clientMessageId: input.clientMessageId ?? null,
            createdAt: now,
          })
          .returning();
        await tx.insert(caseEvents).values({
          caseId: created.id,
          type: 'case_created',
          actorType: 'customer',
          actorId: customer.id,
          data: { category: input.category, identitySource: customer.source },
          createdAt: now,
        });
        return { row: created, message: first };
      });
      this.publishCaseUpdated(row);
      this.publishMessage(row, toMessage(message));
      return this.customerDetail(row);
    } catch (error) {
      // Two retries raced past the lookup: the unique index kept one case; return it (RULE-SUP-03).
      if (input.clientMessageId && isUniqueViolation(error)) {
        const existing = await this.findCaseByClientMessage(customer.id, input.clientMessageId);
        if (existing) return this.customerDetail(existing);
      }
      throw error;
    }
  }

  async listCustomerCases(customer: CustomerActor): Promise<CaseSummary[]> {
    const rows = await this.db
      .select()
      .from(supportCases)
      .where(eq(supportCases.customerId, customer.id))
      .orderBy(desc(supportCases.lastMessageAt));
    return this.withUnread(rows, 'customer');
  }

  async getCustomerCase(customer: CustomerActor, caseId: string): Promise<CustomerCaseDetail> {
    return this.customerDetail(await this.requireCustomerCase(customer, caseId));
  }

  /** The customer opened the conversation: everything received so far counts as read (§4.3 unread state). */
  async markCustomerRead(customer: CustomerActor, caseId: string): Promise<CaseSummary> {
    const row = await this.requireCustomerCase(customer, caseId);
    const [updated] = await this.db
      .update(supportCases)
      .set({ customerLastReadAt: new Date() })
      .where(eq(supportCases.id, row.id))
      .returning();
    this.publishCaseUpdated(updated);
    return toSummary(updated, 0);
  }

  async postCustomerMessage(customer: CustomerActor, caseId: string, input: PostMessageInput): Promise<CaseMessage> {
    const row = await this.requireCustomerCase(customer, caseId);
    if (row.status === 'closed') {
      // Linked follow-up from a closed case is PH-3 scope (context §7.3); refuse explicitly until then.
      throw new ConflictException('case_closed');
    }
    if (input.clientMessageId) {
      const duplicate = await this.findMessageByClientId(customer.id, input.clientMessageId);
      if (duplicate) return this.messageWithAttachments(duplicate);
    }
    return this.onceByClientMessageId(customer.id, input.clientMessageId, () => this.insertCustomerMessage(customer, row, input));
  }

  private async insertCustomerMessage(customer: CustomerActor, row: SupportCaseRow, input: PostMessageInput): Promise<CaseMessage> {
    const { message, updated, linked } = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [inserted] = await tx
        .insert(caseMessages)
        .values({
          caseId: row.id,
          authorType: 'customer',
          authorId: customer.id,
          body: input.body,
          clientMessageId: input.clientMessageId ?? null,
          createdAt: now,
        })
        .returning();
      const linkedRows = await this.attachments.linkToMessage(tx, customer, row.id, inserted.id, input.attachmentIds ?? []);

      const patch: Partial<SupportCaseRow> = { updatedAt: now, lastMessageAt: now, lastCustomerMessageAt: now };
      if (row.status === 'resolved') {
        // §7.2 simple rule: any customer message reactivates a resolved case, whatever it says.
        patch.status = 'in_progress';
        patch.resolvedAt = null;
        patch.resolutionReason = null;
        await tx.insert(caseEvents).values({
          caseId: row.id,
          type: 'case_reopened',
          actorType: 'customer',
          actorId: customer.id,
          data: { from: row.status, to: 'in_progress' },
          createdAt: now,
        });
      } else if (row.status === 'waiting_customer') {
        patch.status = 'in_progress';
        await tx.insert(caseEvents).values(statusChange(row, 'in_progress', customer.id, 'customer', now));
      }
      const [changed] = await tx.update(supportCases).set(patch).where(eq(supportCases.id, row.id)).returning();
      return { message: inserted, updated: changed, linked: linkedRows };
    });
    const dto = toMessage(message, linked.map(toAttachment));
    this.publishMessage(updated, dto);
    this.publishCaseUpdated(updated);
    return dto;
  }

  // ---------- Staff ----------

  async listStaffCases(staff: StaffActor, view: StaffQueueView): Promise<CaseSummary[]> {
    const open = inArray(supportCases.status, OPEN);
    const query = this.db.select().from(supportCases);
    const rows =
      view === 'unassigned'
        ? await query.where(and(open, isNull(supportCases.assignedAgentId))).orderBy(asc(supportCases.createdAt))
        : view === 'mine'
          ? await query.where(and(open, eq(supportCases.assignedAgentId, staff.id))).orderBy(desc(supportCases.lastMessageAt))
          : await query.where(open).orderBy(desc(supportCases.lastMessageAt));
    return this.withUnread(rows, 'staff');
  }

  async getStaffCase(caseId: string): Promise<StaffCaseDetail> {
    const row = await this.requireCase(caseId);
    const [messages, events, unread] = await Promise.all([
      this.loadMessages(row.id, false),
      this.loadEvents(row.id),
      this.unreadCounts([row.id], 'staff'),
    ]);
    return { ...toSummary(row, unread.get(row.id) ?? 0), messages, events };
  }

  /** Staff opened the conversation: customer messages received so far count as read. */
  async markStaffRead(caseId: string): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    const [updated] = await this.db
      .update(supportCases)
      .set({ staffLastReadAt: new Date() })
      .where(eq(supportCases.id, row.id))
      .returning();
    this.publishCaseUpdated(updated);
    return toSummary(updated, 0);
  }

  async takeCase(staff: StaffActor, caseId: string): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (!OPEN.includes(row.status)) throw new ConflictException('case_not_open');
    if (row.assignedAgentId && row.assignedAgentId !== staff.id) throw new ConflictException('case_assigned_to_other');
    if (row.assignedAgentId === staff.id) return toSummary(row);
    const updated = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [changed] = await this.assign(tx, row, staff, now);
      return changed;
    });
    this.publishCaseUpdated(updated);
    return toSummary(updated);
  }

  async postStaffMessage(staff: StaffActor, caseId: string, input: PostMessageInput): Promise<CaseMessage> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    if (input.clientMessageId) {
      const duplicate = await this.findMessageByClientId(staff.id, input.clientMessageId);
      if (duplicate) return this.messageWithAttachments(duplicate);
    }
    return this.onceByClientMessageId(staff.id, input.clientMessageId, () => this.insertStaffMessage(staff, row, input));
  }

  private async insertStaffMessage(staff: StaffActor, row: SupportCaseRow, input: PostMessageInput): Promise<CaseMessage> {
    const { message, updated, linked } = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [inserted] = await tx
        .insert(caseMessages)
        .values({
          caseId: row.id,
          authorType: 'staff',
          authorId: staff.id,
          authorName: staff.displayName,
          visibility: 'public',
          body: input.body,
          clientMessageId: input.clientMessageId ?? null,
          createdAt: now,
        })
        .returning();
      const linkedRows = await this.attachments.linkToMessage(tx, staff, row.id, inserted.id, input.attachmentIds ?? []);
      // Replying to an unowned case makes the replier responsible for it (RULE-SUP-02).
      const current = row.assignedAgentId ? row : (await this.assign(tx, row, staff, now))[0];
      const [changed] = await tx
        .update(supportCases)
        .set({ updatedAt: now, lastMessageAt: now, lastStaffMessageAt: now })
        .where(eq(supportCases.id, current.id))
        .returning();
      return { message: inserted, updated: changed, linked: linkedRows };
    });
    const dto = toMessage(message, linked.map(toAttachment));
    this.publishMessage(updated, dto);
    this.publishCaseUpdated(updated);
    return dto;
  }

  /**
   * Concurrent retries of the same send can both pass the duplicate lookup; the unique index keeps one row
   * and the loser returns the winner's message instead of failing (RULE-SUP-03, FND-0005).
   */
  private async onceByClientMessageId(authorId: string, clientMessageId: string | undefined, insert: () => Promise<CaseMessage>): Promise<CaseMessage> {
    try {
      return await insert();
    } catch (error) {
      if (clientMessageId && isUniqueViolation(error)) {
        const existing = await this.findMessageByClientId(authorId, clientMessageId);
        if (existing) return this.messageWithAttachments(existing);
      }
      throw error;
    }
  }

  // ---------- Lifecycle (PH-3.1): status means "work still required" (§7) ----------

  /**
   * Staff say what the case is waiting for. Acting on an unowned case makes the actor responsible
   * (RULE-SUP-02). `resolved` and `closed` have their own flows; `closed` cases do not move here.
   */
  async setStatus(staff: StaffActor, caseId: string, target: StaffStatusTarget): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    const updated = await this.db.transaction(async (tx) => {
      const now = new Date();
      const current = row.assignedAgentId ? row : (await this.assign(tx, row, staff, now))[0];
      if (current.status === target) return current;
      await tx.insert(caseEvents).values(statusChange(current, target, staff.id, 'staff', now));
      const [changed] = await tx
        .update(supportCases)
        .set({ status: target, updatedAt: now, resolvedAt: null, resolutionReason: null })
        .where(eq(supportCases.id, current.id))
        .returning();
      return changed;
    });
    this.publishCaseUpdated(updated);
    return toSummary(updated);
  }

  /**
   * A supported conclusion: reason code plus an explanation the customer reads in the conversation (§7.1).
   * Resolving changes nothing but the case itself (RULE-SUP-05). The customer can reactivate by replying.
   */
  async resolve(staff: StaffActor, caseId: string, input: ResolveCaseInput): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    if (row.status === 'resolved') throw new ConflictException('case_already_resolved');
    const { updated, message } = await this.db.transaction(async (tx) => {
      const now = new Date();
      const current = row.assignedAgentId ? row : (await this.assign(tx, row, staff, now))[0];
      const [explanation] = await tx
        .insert(caseMessages)
        .values({
          caseId: current.id,
          authorType: 'staff',
          authorId: staff.id,
          authorName: staff.displayName,
          visibility: 'public',
          body: input.explanation,
          createdAt: now,
        })
        .returning();
      await tx.insert(caseEvents).values(statusChange(current, 'resolved', staff.id, 'staff', now));
      await tx.insert(caseEvents).values({
        caseId: current.id,
        type: 'case_resolved',
        actorType: 'staff',
        actorId: staff.id,
        data: { reason: input.reason, messageId: explanation.id },
        createdAt: now,
      });
      const [changed] = await tx
        .update(supportCases)
        .set({
          status: 'resolved',
          resolvedAt: now,
          resolutionReason: input.reason,
          updatedAt: now,
          lastMessageAt: now,
          lastStaffMessageAt: now,
        })
        .where(eq(supportCases.id, current.id))
        .returning();
      return { updated: changed, message: explanation };
    });
    this.publishMessage(updated, toMessage(message));
    this.publishCaseUpdated(updated);
    return toSummary(updated);
  }

  // ---------- Rows for controllers that need the case before acting (attachments) ----------

  /** The customer's own case row, or 404 (RULE-SUP-01). */
  requireOwnCaseRow(customer: CustomerActor, caseId: string): Promise<SupportCaseRow> {
    return this.requireCustomerCase(customer, caseId);
  }

  /** Any case row for staff, or 404. */
  requireCaseRow(caseId: string): Promise<SupportCaseRow> {
    return this.requireCase(caseId);
  }

  // ---------- Live updates (ADR-0004): published only after the transaction committed ----------

  private publishCaseUpdated(row: SupportCaseRow): void {
    this.events.publish({
      type: 'case.updated',
      caseId: row.id,
      customerId: row.customerId,
      summary: toSummary(row),
      at: new Date().toISOString(),
    });
  }

  private publishMessage(row: SupportCaseRow, message: CaseMessage): void {
    this.events.publish({
      type: 'message.created',
      caseId: row.id,
      customerId: row.customerId,
      message,
      at: new Date().toISOString(),
    });
  }

  private async messageWithAttachments(row: CaseMessageRow): Promise<CaseMessage> {
    const grouped = await this.attachments.forMessages([row.id]);
    return toMessage(row, grouped.get(row.id) ?? []);
  }

  // ---------- Internals ----------

  private async assign(tx: Db, row: SupportCaseRow, staff: StaffActor, now: Date) {
    const nextStatus: CaseStatus = row.status === 'new' ? 'in_progress' : row.status;
    await tx.insert(caseEvents).values({
      caseId: row.id,
      type: 'case_assigned',
      actorType: 'staff',
      actorId: staff.id,
      data: { agentId: staff.id, agentName: staff.displayName, previousAgentId: row.assignedAgentId },
      createdAt: now,
    });
    if (nextStatus !== row.status) {
      await tx.insert(caseEvents).values(statusChange(row, nextStatus, staff.id, 'staff', now));
    }
    return tx
      .update(supportCases)
      .set({ assignedAgentId: staff.id, status: nextStatus, updatedAt: now })
      .where(eq(supportCases.id, row.id))
      .returning();
  }

  private async requireCase(caseId: string): Promise<SupportCaseRow> {
    const [row] = await this.db.select().from(supportCases).where(eq(supportCases.id, caseId)).limit(1);
    if (!row) throw new NotFoundException('case_not_found');
    return row;
  }

  /** 404 for both "absent" and "someone else's": knowing an id must not reveal existence (RULE-SUP-01). */
  private async requireCustomerCase(customer: CustomerActor, caseId: string): Promise<SupportCaseRow> {
    const [row] = await this.db
      .select()
      .from(supportCases)
      .where(and(eq(supportCases.id, caseId), eq(supportCases.customerId, customer.id)))
      .limit(1);
    if (!row) throw new NotFoundException('case_not_found');
    return row;
  }

  private async customerDetail(row: SupportCaseRow): Promise<CustomerCaseDetail> {
    const [messages, unread] = await Promise.all([this.loadMessages(row.id, true), this.unreadCounts([row.id], 'customer')]);
    return { ...toSummary(row, unread.get(row.id) ?? 0), messages };
  }

  private async withUnread(rows: SupportCaseRow[], viewer: 'customer' | 'staff'): Promise<CaseSummary[]> {
    const unread = await this.unreadCounts(rows.map((r) => r.id), viewer);
    return rows.map((row) => toSummary(row, unread.get(row.id) ?? 0));
  }

  /**
   * Unread = messages from the other side newer than the viewer's read marker. Customers only ever count
   * public messages (internal notes do not exist for them — RULE-SUP-04).
   */
  private async unreadCounts(caseIds: string[], viewer: 'customer' | 'staff'): Promise<Map<string, number>> {
    if (caseIds.length === 0) return new Map();
    const readMarker = viewer === 'customer' ? supportCases.customerLastReadAt : supportCases.staffLastReadAt;
    const fromOtherSide =
      viewer === 'customer'
        ? and(ne(caseMessages.authorType, 'customer'), eq(caseMessages.visibility, 'public'))
        : eq(caseMessages.authorType, 'customer');
    const rows = await this.db
      .select({ caseId: caseMessages.caseId, unread: count() })
      .from(caseMessages)
      .innerJoin(supportCases, eq(supportCases.id, caseMessages.caseId))
      .where(and(inArray(caseMessages.caseId, caseIds), fromOtherSide, or(isNull(readMarker), gt(caseMessages.createdAt, readMarker))))
      .groupBy(caseMessages.caseId);
    return new Map(rows.map((r) => [r.caseId, Number(r.unread)]));
  }

  private async loadMessages(caseId: string, publicOnly: boolean): Promise<CaseMessage[]> {
    const scope = publicOnly
      ? and(eq(caseMessages.caseId, caseId), eq(caseMessages.visibility, 'public'))
      : eq(caseMessages.caseId, caseId);
    const rows = await this.db.select().from(caseMessages).where(scope).orderBy(asc(caseMessages.createdAt));
    const grouped = await this.attachments.forMessages(rows.map((r) => r.id));
    return rows.map((row) => toMessage(row, grouped.get(row.id) ?? []));
  }

  private async loadEvents(caseId: string): Promise<CaseEvent[]> {
    const rows = await this.db.select().from(caseEvents).where(eq(caseEvents.caseId, caseId)).orderBy(asc(caseEvents.createdAt));
    return rows.map(toEvent);
  }

  private async findMessageByClientId(authorId: string, clientMessageId: string): Promise<CaseMessageRow | undefined> {
    const [row] = await this.db
      .select()
      .from(caseMessages)
      .where(and(eq(caseMessages.authorId, authorId), eq(caseMessages.clientMessageId, clientMessageId)))
      .limit(1);
    return row;
  }

  private async findCaseByClientMessage(customerId: string, clientMessageId: string): Promise<SupportCaseRow | undefined> {
    const message = await this.findMessageByClientId(customerId, clientMessageId);
    if (!message) return undefined;
    const [row] = await this.db
      .select()
      .from(supportCases)
      .where(and(eq(supportCases.id, message.caseId), eq(supportCases.customerId, customerId)))
      .limit(1);
    return row;
  }
}

function statusChange(
  row: SupportCaseRow,
  to: CaseStatus,
  actorId: string,
  actorType: 'customer' | 'staff' | 'system',
  now: Date,
): typeof caseEvents.$inferInsert {
  return { caseId: row.id, type: 'status_changed', actorType, actorId, data: { from: row.status, to }, createdAt: now };
}

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

function toSummary(row: SupportCaseRow, unreadCount = 0): CaseSummary {
  return {
    id: row.id,
    reference: formatCaseReference(row.referenceNumber),
    customerId: row.customerId,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    assignedAgentId: row.assignedAgentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastCustomerMessageAt: iso(row.lastCustomerMessageAt),
    lastStaffMessageAt: iso(row.lastStaffMessageAt),
    customerLastReadAt: iso(row.customerLastReadAt),
    staffLastReadAt: iso(row.staffLastReadAt),
    unreadCount,
    resolvedAt: iso(row.resolvedAt),
    resolutionReason: (row.resolutionReason as ResolutionReason | null) ?? null,
  };
}

function toMessage(row: CaseMessageRow, attachments: CaseMessage['attachments'] = []): CaseMessage {
  return {
    id: row.id,
    caseId: row.caseId,
    authorType: row.authorType,
    authorId: row.authorId,
    authorName: row.authorName,
    visibility: row.visibility,
    body: row.body,
    clientMessageId: row.clientMessageId,
    createdAt: row.createdAt.toISOString(),
    attachments,
  };
}

function toEvent(row: CaseEventRow): CaseEvent {
  return {
    id: row.id,
    caseId: row.caseId,
    type: row.type,
    actorType: row.actorType,
    actorId: row.actorId,
    data: row.data,
    createdAt: row.createdAt.toISOString(),
  };
}
