import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import {
  type AnswerConsultationInput,
  type AssignCaseInput,
  type CaseConsultation,
  type CaseEvent,
  type CaseMessage,
  type CaseStatus,
  type CaseSummary,
  type CreateCaseInput,
  type CreateIncidentInput,
  type CustomerCaseDetail,
  deriveSubject,
  type FollowUpInput,
  formatCaseReference,
  type Incident,
  type IncidentNoteInput,
  type IncidentStatus,
  OPEN_CASE_STATUSES,
  type PostMessageInput,
  type PostNoteInput,
  type RequestConsultationInput,
  type ResolutionReason,
  type ResolveCaseInput,
  type StaffCaseDetail,
  type StaffQueueView,
  type StaffStatusTarget,
  type UpdateCaseInput,
} from '@orbit-support/shared';
import { AttachmentsService, toAttachment } from '../attachments/attachments.service.js';
import { type Db, isUniqueViolation } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { CaseEventBus } from '../events/case-event-bus.js';
import {
  type CaseConsultationRow,
  caseConsultations,
  type CaseEventRow,
  caseEvents,
  type CaseMessageRow,
  caseMessages,
  type IncidentRow,
  incidents,
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
    return this.summaryOf(updated, 'customer');
  }

  /**
   * "Preciso de mais ajuda" from a closed case (§7.3, RULE-SUP-06): a new case for the same customer, linked
   * to the closed one, with a system message pointing back so nobody retells the whole story.
   */
  async createFollowUp(customer: CustomerActor, parentCaseId: string, input: FollowUpInput): Promise<CustomerCaseDetail> {
    const parent = await this.requireCustomerCase(customer, parentCaseId);
    if (parent.status !== 'closed') throw new ConflictException('case_not_closed');
    if (input.clientMessageId) {
      const existing = await this.findCaseByClientMessage(customer.id, input.clientMessageId);
      if (existing) return this.customerDetail(existing);
    }
    const parentReference = formatCaseReference(parent.referenceNumber);
    const { child, firstMessage } = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [created] = await tx
        .insert(supportCases)
        .values({
          customerId: customer.id,
          subject: deriveSubject(input.message),
          category: parent.category,
          parentCaseId: parent.id,
          createdAt: now,
          updatedAt: now,
          lastMessageAt: now,
          lastCustomerMessageAt: now,
        })
        .returning();
      const childReference = formatCaseReference(created.referenceNumber);
      await tx.insert(caseMessages).values({
        caseId: created.id,
        authorType: 'system',
        authorId: 'system',
        body: `Continuação do caso ${parentReference}.`,
        createdAt: now,
      });
      const [message] = await tx
        .insert(caseMessages)
        .values({
          caseId: created.id,
          authorType: 'customer',
          authorId: customer.id,
          body: input.message,
          clientMessageId: input.clientMessageId ?? null,
          createdAt: new Date(now.getTime() + 1),
        })
        .returning();
      await tx.insert(caseEvents).values([
        {
          caseId: created.id,
          type: 'follow_up_created',
          actorType: 'customer',
          actorId: customer.id,
          data: { parentCaseId: parent.id, parentReference },
          createdAt: now,
        },
        {
          caseId: parent.id,
          type: 'follow_up_created',
          actorType: 'customer',
          actorId: customer.id,
          data: { followUpCaseId: created.id, followUpReference: childReference },
          createdAt: now,
        },
      ]);
      return { child: created, firstMessage: message };
    });
    this.publishCaseUpdated(child);
    this.publishMessage(child, toMessage(firstMessage));
    this.publishCaseUpdated(parent);
    return this.customerDetail(child);
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
    const [messages, events, summary, consultations] = await Promise.all([
      this.loadMessages(row.id, false),
      this.loadEvents(row.id),
      this.summaryOf(row),
      this.loadConsultations(row.id),
    ]);
    return { ...summary, messages, events, consultations };
  }

  // ---------- Internal collaboration (PH-3.2): never visible to customers (RULE-SUP-04) ----------

  /** An internal note: a message only staff can see. It does not change the case's customer-facing timeline. */
  async postInternalNote(staff: StaffActor, caseId: string, input: PostNoteInput): Promise<CaseMessage> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    const now = new Date();
    const [note] = await this.db
      .insert(caseMessages)
      .values({
        caseId: row.id,
        authorType: 'staff',
        authorId: staff.id,
        authorName: staff.displayName,
        visibility: 'internal',
        body: input.body,
        createdAt: now,
      })
      .returning();
    const [updated] = await this.db.update(supportCases).set({ updatedAt: now }).where(eq(supportCases.id, row.id)).returning();
    const dto = toMessage(note);
    this.publishMessage(updated, dto); // customer streams filter internal visibility
    return dto;
  }

  /** Ask another team; the owner stays responsible for the customer and the case waits for the internal team. */
  async requestConsultation(staff: StaffActor, caseId: string, input: RequestConsultationInput): Promise<CaseConsultation> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    const { consultation, updated } = await this.db.transaction(async (tx) => {
      const now = new Date();
      const current = row.assignedAgentId ? row : (await this.assign(tx, row, staff, now))[0];
      const [created] = await tx
        .insert(caseConsultations)
        .values({
          caseId: current.id,
          team: input.team,
          question: input.question,
          requestedById: staff.id,
          requestedByName: staff.displayName,
          requestedAt: now,
        })
        .returning();
      await tx.insert(caseEvents).values({
        caseId: current.id,
        type: 'consultation_requested',
        actorType: 'staff',
        actorId: staff.id,
        data: { consultationId: created.id, team: input.team },
        createdAt: now,
      });
      let changed = current;
      if (current.status !== 'waiting_internal') {
        await tx.insert(caseEvents).values(statusChange(current, 'waiting_internal', staff.id, 'staff', now));
        [changed] = await tx
          .update(supportCases)
          .set({ status: 'waiting_internal', updatedAt: now })
          .where(eq(supportCases.id, current.id))
          .returning();
      }
      return { consultation: created, updated: changed };
    });
    this.publishCaseUpdated(updated);
    return toConsultation(consultation);
  }

  /** The specialist answers; when nothing else is pending internally, the case returns to the owner's attention. */
  async answerConsultation(staff: StaffActor, caseId: string, consultationId: string, input: AnswerConsultationInput): Promise<CaseConsultation> {
    const row = await this.requireCase(caseId);
    const [existing] = await this.db
      .select()
      .from(caseConsultations)
      .where(and(eq(caseConsultations.id, consultationId), eq(caseConsultations.caseId, row.id)))
      .limit(1);
    if (!existing) throw new NotFoundException('consultation_not_found');
    if (existing.status === 'answered') throw new ConflictException('consultation_already_answered');
    const { consultation, updated } = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [answered] = await tx
        .update(caseConsultations)
        .set({ status: 'answered', answer: input.answer, answeredById: staff.id, answeredByName: staff.displayName, answeredAt: now })
        .where(eq(caseConsultations.id, existing.id))
        .returning();
      await tx.insert(caseEvents).values({
        caseId: row.id,
        type: 'consultation_answered',
        actorType: 'staff',
        actorId: staff.id,
        data: { consultationId: existing.id, team: existing.team, answeredByName: staff.displayName },
        createdAt: now,
      });
      const [{ open }] = await tx
        .select({ open: count() })
        .from(caseConsultations)
        .where(and(eq(caseConsultations.caseId, row.id), eq(caseConsultations.status, 'open')));
      let changed = row;
      if (Number(open) === 0 && row.status === 'waiting_internal') {
        await tx.insert(caseEvents).values(statusChange(row, 'in_progress', staff.id, 'staff', now));
        [changed] = await tx.update(supportCases).set({ status: 'in_progress', updatedAt: now }).where(eq(supportCases.id, row.id)).returning();
      } else {
        [changed] = await tx.update(supportCases).set({ updatedAt: now }).where(eq(supportCases.id, row.id)).returning();
      }
      return { consultation: answered, updated: changed };
    });
    this.publishCaseUpdated(updated);
    return toConsultation(consultation);
  }

  private async loadConsultations(caseId: string): Promise<CaseConsultation[]> {
    const rows = await this.db
      .select()
      .from(caseConsultations)
      .where(eq(caseConsultations.caseId, caseId))
      .orderBy(asc(caseConsultations.requestedAt));
    return rows.map(toConsultation);
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
    return this.summaryOf(updated);
  }

  // ---------- Closure (PH-3.4, §7.3): only resolved cases close; history stays; follow-ups link back ----------

  /** Staff close a resolved case explicitly. */
  async closeCase(staff: StaffActor, caseId: string): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (row.status !== 'resolved') throw new ConflictException('case_not_resolved');
    const updated = await this.closeRow(row, 'staff', { actorType: 'staff', actorId: staff.id });
    return this.summaryOf(updated);
  }

  /**
   * Closes resolved cases whose latest resolution is older than the follow-up window (working default 7 days,
   * context §13.1). Idempotent; returns how many were closed. Called by the closure job and by tests.
   */
  async closeExpired(now = new Date(), windowDays = followUpWindowDays()): Promise<number> {
    const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const expired = await this.db
      .select()
      .from(supportCases)
      .where(and(eq(supportCases.status, 'resolved'), lt(supportCases.resolvedAt, cutoff)));
    for (const row of expired) {
      await this.closeRow(row, 'auto_window', { actorType: 'system', actorId: 'closure-job' }, now);
    }
    return expired.length;
  }

  private async closeRow(
    row: SupportCaseRow,
    reason: 'auto_window' | 'staff',
    actor: { actorType: 'staff' | 'system'; actorId: string },
    now = new Date(),
  ): Promise<SupportCaseRow> {
    const updated = await this.db.transaction(async (tx) => {
      await tx.insert(caseEvents).values([
        { ...statusChange(row, 'closed', actor.actorId, actor.actorType, now) },
        { caseId: row.id, type: 'case_closed', actorType: actor.actorType, actorId: actor.actorId, data: { reason }, createdAt: now },
      ]);
      const [changed] = await tx
        .update(supportCases)
        .set({ status: 'closed', closedAt: now, closedReason: reason, updatedAt: now })
        .where(and(eq(supportCases.id, row.id), eq(supportCases.status, 'resolved')))
        .returning();
      return changed ?? row;
    });
    this.publishCaseUpdated(updated);
    return updated;
  }

  async takeCase(staff: StaffActor, caseId: string): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (!OPEN.includes(row.status)) throw new ConflictException('case_not_open');
    if (row.assignedAgentId && row.assignedAgentId !== staff.id) throw new ConflictException('case_assigned_to_other');
    if (row.assignedAgentId === staff.id) return this.summaryOf(row);
    const updated = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [changed] = await this.assign(tx, row, staff, now);
      return changed;
    });
    this.publishCaseUpdated(updated);
    return this.summaryOf(updated);
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

  // ---------- Shared incidents (PH-3.5, §5.4): association + coordinated internal notes; never auto-resolution ----------

  async createIncident(staff: StaffActor, input: CreateIncidentInput): Promise<Incident> {
    const [row] = await this.db
      .insert(incidents)
      .values({ title: input.title, description: input.description ?? null, createdById: staff.id, createdByName: staff.displayName })
      .returning();
    return toIncident(row, 0);
  }

  async listIncidents(status?: IncidentStatus): Promise<Incident[]> {
    const rows = await this.db
      .select()
      .from(incidents)
      .where(status ? eq(incidents.status, status) : undefined)
      .orderBy(desc(incidents.createdAt));
    const counts = await this.linkedCaseCounts(rows.map((r) => r.id));
    return rows.map((row) => toIncident(row, counts.get(row.id) ?? 0));
  }

  /** Associate a case with an open incident, or unlink it (`incidentId: null`). Conversations stay separate. */
  async linkIncident(staff: StaffActor, caseId: string, incidentId: string | null): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    let incident: IncidentRow | null = null;
    if (incidentId) {
      incident = await this.requireIncident(incidentId);
      if (incident.status !== 'open') throw new ConflictException('incident_resolved');
    }
    if (row.incidentId === incidentId) return this.summaryOf(row);
    const updated = await this.db.transaction(async (tx) => {
      const now = new Date();
      await tx.insert(caseEvents).values({
        caseId: row.id,
        type: 'incident_linked',
        actorType: 'staff',
        actorId: staff.id,
        data: incident
          ? { incidentId: incident.id, title: incident.title, previousIncidentId: row.incidentId }
          : { incidentId: null, unlinked: true, previousIncidentId: row.incidentId },
        createdAt: now,
      });
      const [changed] = await tx.update(supportCases).set({ incidentId, updatedAt: now }).where(eq(supportCases.id, row.id)).returning();
      return changed;
    });
    this.publishCaseUpdated(updated);
    return this.summaryOf(updated);
  }

  /** One internal note delivered to every linked open case — the "coordinated update" of §5.4. */
  async broadcastIncidentNote(staff: StaffActor, incidentId: string, input: IncidentNoteInput): Promise<{ delivered: number }> {
    const incident = await this.requireIncident(incidentId);
    const linked = await this.db
      .select()
      .from(supportCases)
      .where(and(eq(supportCases.incidentId, incident.id), inArray(supportCases.status, OPEN)));
    for (const row of linked) {
      await this.postInternalNote(staff, row.id, { body: `[Incidente “${incident.title}”] ${input.body}` });
    }
    return { delivered: linked.length };
  }

  /** Marks the incident resolved and tells every linked open case's team — without touching any case status. */
  async resolveIncident(staff: StaffActor, incidentId: string): Promise<Incident> {
    const incident = await this.requireIncident(incidentId);
    if (incident.status === 'resolved') throw new ConflictException('incident_already_resolved');
    const now = new Date();
    const [updated] = await this.db
      .update(incidents)
      .set({ status: 'resolved', resolvedAt: now, resolvedById: staff.id })
      .where(eq(incidents.id, incident.id))
      .returning();
    const linked = await this.db
      .select()
      .from(supportCases)
      .where(and(eq(supportCases.incidentId, incident.id), inArray(supportCases.status, OPEN)));
    for (const row of linked) {
      await this.postInternalNote(staff, row.id, {
        body: `[Incidente “${incident.title}”] Incidente marcado como resolvido por ${staff.displayName}. Confirme se o caso deste cliente está de fato resolvido antes de encerrá-lo.`,
      });
    }
    const counts = await this.linkedCaseCounts([incident.id]);
    return toIncident(updated, counts.get(incident.id) ?? 0);
  }

  private async requireIncident(incidentId: string): Promise<IncidentRow> {
    const [row] = await this.db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    if (!row) throw new NotFoundException('incident_not_found');
    return row;
  }

  private async linkedCaseCounts(incidentIds: string[]): Promise<Map<string, number>> {
    if (incidentIds.length === 0) return new Map();
    const rows = await this.db
      .select({ incidentId: supportCases.incidentId, linked: count() })
      .from(supportCases)
      .where(inArray(supportCases.incidentId, incidentIds))
      .groupBy(supportCases.incidentId);
    return new Map(rows.filter((r) => r.incidentId !== null).map((r) => [r.incidentId as string, Number(r.linked)]));
  }

  /** Incident titles keyed by case id, for summaries. */
  private async incidentTitles(rows: SupportCaseRow[]): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map((r) => r.incidentId).filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Map();
    const found = await this.db.select({ id: incidents.id, title: incidents.title }).from(incidents).where(inArray(incidents.id, ids));
    const byId = new Map(found.map((i) => [i.id, i.title]));
    const result = new Map<string, string>();
    for (const row of rows) {
      const title = row.incidentId ? byId.get(row.incidentId) : undefined;
      if (title) result.set(row.id, title);
    }
    return result;
  }

  // ---------- Assignment and attributes (PH-3.3): ownership changes keep everything else (RULE-SUP-02) ----------

  /**
   * Transfer to a colleague or release to the queue (`agentId: null`). Allowed for the current owner, for
   * anyone when the case is unowned, and for supervisors/admins (someone became unavailable — context §5.2).
   */
  async assignCase(staff: StaffActor, caseId: string, input: AssignCaseInput): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    const mayReassign = row.assignedAgentId === null || row.assignedAgentId === staff.id || staff.role !== 'agent';
    if (!mayReassign) throw new ForbiddenException('not_case_owner');
    if (row.assignedAgentId === input.agentId) return this.summaryOf(row);
    const updated = await this.db.transaction(async (tx) => {
      const now = new Date();
      await tx.insert(caseEvents).values({
        caseId: row.id,
        type: 'case_assigned',
        actorType: 'staff',
        actorId: staff.id,
        data: input.agentId
          ? { agentId: input.agentId, previousAgentId: row.assignedAgentId, transferredByName: staff.displayName }
          : { agentId: null, previousAgentId: row.assignedAgentId, released: true, releasedByName: staff.displayName },
        createdAt: now,
      });
      const [changed] = await tx
        .update(supportCases)
        .set({ assignedAgentId: input.agentId, updatedAt: now })
        .where(eq(supportCases.id, row.id))
        .returning();
      return changed;
    });
    this.publishCaseUpdated(updated);
    return this.summaryOf(updated);
  }

  /** Priority and category corrections, each recorded as an attributable event (§5.4, RULE-SUP-09). */
  async updateAttributes(staff: StaffActor, caseId: string, input: UpdateCaseInput): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    const updated = await this.db.transaction(async (tx) => {
      const now = new Date();
      const patch: Partial<SupportCaseRow> = { updatedAt: now };
      if (input.priority && input.priority !== row.priority) {
        patch.priority = input.priority;
        await tx.insert(caseEvents).values({
          caseId: row.id,
          type: 'priority_changed',
          actorType: 'staff',
          actorId: staff.id,
          data: { from: row.priority, to: input.priority },
          createdAt: now,
        });
      }
      if (input.category && input.category !== row.category) {
        patch.category = input.category;
        await tx.insert(caseEvents).values({
          caseId: row.id,
          type: 'category_changed',
          actorType: 'staff',
          actorId: staff.id,
          data: { from: row.category, to: input.category },
          createdAt: now,
        });
      }
      const [changed] = await tx.update(supportCases).set(patch).where(eq(supportCases.id, row.id)).returning();
      return changed;
    });
    this.publishCaseUpdated(updated);
    return this.summaryOf(updated);
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
    return this.summaryOf(updated);
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
    return this.summaryOf(updated);
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
    const [messages, summary] = await Promise.all([this.loadMessages(row.id, true), this.summaryOf(row, 'customer')]);
    return { ...summary, messages };
  }

  /** Summaries with viewer-dependent unread counts, the parent reference for follow-ups and the incident title. */
  private async withUnread(rows: SupportCaseRow[], viewer: 'customer' | 'staff'): Promise<CaseSummary[]> {
    const [unread, parents, incidentTitles] = await Promise.all([
      this.unreadCounts(rows.map((r) => r.id), viewer),
      this.parentReferences(rows),
      this.incidentTitles(rows),
    ]);
    return rows.map((row) => toSummary(row, unread.get(row.id) ?? 0, parents.get(row.id) ?? null, incidentTitles.get(row.id) ?? null));
  }

  private async summaryOf(row: SupportCaseRow, viewer: 'customer' | 'staff' = 'staff'): Promise<CaseSummary> {
    const [summary] = await this.withUnread([row], viewer);
    return summary;
  }

  /** `SUP-…` of each row's parent case, keyed by the child's id. */
  private async parentReferences(rows: SupportCaseRow[]): Promise<Map<string, string>> {
    const parentIds = [...new Set(rows.map((r) => r.parentCaseId).filter((id): id is string => id !== null))];
    if (parentIds.length === 0) return new Map();
    const parents = await this.db
      .select({ id: supportCases.id, referenceNumber: supportCases.referenceNumber })
      .from(supportCases)
      .where(inArray(supportCases.id, parentIds));
    const byParent = new Map(parents.map((p) => [p.id, formatCaseReference(p.referenceNumber)]));
    const result = new Map<string, string>();
    for (const row of rows) {
      const reference = row.parentCaseId ? byParent.get(row.parentCaseId) : undefined;
      if (reference) result.set(row.id, reference);
    }
    return result;
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

/** Follow-up window in days (context §13.1 working default 7); `SUPPORT_FOLLOW_UP_WINDOW_DAYS` overrides. */
export function followUpWindowDays(): number {
  const parsed = Number(process.env.SUPPORT_FOLLOW_UP_WINDOW_DAYS ?? 7);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

function toIncident(row: IncidentRow, linkedCaseCount: number): Incident {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: iso(row.resolvedAt),
    resolvedById: row.resolvedById,
    linkedCaseCount,
  };
}

function toSummary(row: SupportCaseRow, unreadCount = 0, parentReference: string | null = null, incidentTitle: string | null = null): CaseSummary {
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
    closedAt: iso(row.closedAt),
    parentCaseId: row.parentCaseId,
    parentReference,
    incidentId: row.incidentId,
    incidentTitle,
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

function toConsultation(row: CaseConsultationRow): CaseConsultation {
  return {
    id: row.id,
    caseId: row.caseId,
    team: row.team,
    question: row.question,
    status: row.status,
    requestedById: row.requestedById,
    requestedByName: row.requestedByName,
    requestedAt: row.requestedAt.toISOString(),
    answeredById: row.answeredById,
    answeredByName: row.answeredByName,
    answeredAt: iso(row.answeredAt),
    answer: row.answer,
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
