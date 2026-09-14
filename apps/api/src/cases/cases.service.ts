import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
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
  type StaffCaseDetail,
  type StaffQueueView,
} from '@orbit-support/shared';
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
      this.publishMessage(row, message);
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
    return rows.map(toSummary);
  }

  async getCustomerCase(customer: CustomerActor, caseId: string): Promise<CustomerCaseDetail> {
    return this.customerDetail(await this.requireCustomerCase(customer, caseId));
  }

  async postCustomerMessage(customer: CustomerActor, caseId: string, input: PostMessageInput): Promise<CaseMessage> {
    const row = await this.requireCustomerCase(customer, caseId);
    if (row.status === 'closed') {
      // Linked follow-up from a closed case is PH-3 scope (context §7.3); refuse explicitly until then.
      throw new ConflictException('case_closed');
    }
    if (input.clientMessageId) {
      const duplicate = await this.findMessageByClientId(customer.id, input.clientMessageId);
      if (duplicate) return toMessage(duplicate);
    }
    const { message, updated } = await this.db.transaction(async (tx) => {
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

      const patch: Partial<SupportCaseRow> = { updatedAt: now, lastMessageAt: now, lastCustomerMessageAt: now };
      if (row.status === 'resolved') {
        // §7.2 simple rule: any customer message reactivates a resolved case, whatever it says.
        patch.status = 'in_progress';
        patch.resolvedAt = null;
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
      return { message: inserted, updated: changed };
    });
    this.publishMessage(updated, message);
    this.publishCaseUpdated(updated);
    return toMessage(message);
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
    return rows.map(toSummary);
  }

  async getStaffCase(caseId: string): Promise<StaffCaseDetail> {
    const row = await this.requireCase(caseId);
    const [messages, events] = await Promise.all([this.loadMessages(row.id, false), this.loadEvents(row.id)]);
    return { ...toSummary(row), messages, events };
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
      if (duplicate) return toMessage(duplicate);
    }
    const { message, updated } = await this.db.transaction(async (tx) => {
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
      // Replying to an unowned case makes the replier responsible for it (RULE-SUP-02).
      const current = row.assignedAgentId ? row : (await this.assign(tx, row, staff, now))[0];
      const [changed] = await tx
        .update(supportCases)
        .set({ updatedAt: now, lastMessageAt: now, lastStaffMessageAt: now })
        .where(eq(supportCases.id, current.id))
        .returning();
      return { message: inserted, updated: changed };
    });
    this.publishMessage(updated, message);
    this.publishCaseUpdated(updated);
    return toMessage(message);
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

  private publishMessage(row: SupportCaseRow, message: CaseMessageRow): void {
    this.events.publish({
      type: 'message.created',
      caseId: row.id,
      customerId: row.customerId,
      message: toMessage(message),
      at: new Date().toISOString(),
    });
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
    return { ...toSummary(row), messages: await this.loadMessages(row.id, true) };
  }

  private async loadMessages(caseId: string, publicOnly: boolean): Promise<CaseMessage[]> {
    const scope = publicOnly
      ? and(eq(caseMessages.caseId, caseId), eq(caseMessages.visibility, 'public'))
      : eq(caseMessages.caseId, caseId);
    const rows = await this.db.select().from(caseMessages).where(scope).orderBy(asc(caseMessages.createdAt));
    return rows.map(toMessage);
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

function toSummary(row: SupportCaseRow): CaseSummary {
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
  };
}

function toMessage(row: CaseMessageRow): CaseMessage {
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
