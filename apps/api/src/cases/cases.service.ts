import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, lt, min, ne, or, sql } from 'drizzle-orm';
import { type AnswerConsultationInput, type AssignCaseInput, type CaseConsultation, type CaseEvent, type CaseMessage, type CaseRecord, type CaseRecordRef, type CaseStatus, type CaseSummary, type CreateCaseInput, type CreateIncidentInput, type CustomerCaseDetail, type CustomerCaseEvent, type CustomerCaseSummary, deriveSubject, type FollowUpInput, formatCaseReference, type Incident, type IncidentNoteInput, type IncidentStatus, type MessageAuthorType, OPEN_CASE_STATUSES, type OrbitRecord, type OrbitRecordKind, type OrbitUnavailableReason, type PostMessageInput, type PostNoteInput, type RequestConsultationInput, type ResolutionReason, type ResolveCaseInput, type StaffCaseDetail, STAFF_LIST_LIMITS, type StaffListQuery, type StaffQueueView, type StaffStatusTarget, type SystemMessageKind, toCustomerCaseSummary, type UpdateCaseInput, businessDaysAfter, COMPLAINT_DEADLINE_BUSINESS_DAYS, staffMayWorkComplaint, type StaffRole } from '@orbit-support/shared';
import { AttachmentsService, toAttachment } from '../attachments/attachments.service.js';
import { positiveNumberEnv } from '../common/env.js';
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
import { caseOwnership, type StaffAction, staffMay } from '@orbit-support/shared';
import { ORBIT_RECORDS, type OrbitRecordsPort } from '../identity/orbit-records.js';
import { STAFF_DIRECTORY, type StaffDirectory } from '../identity/staff-directory.js';
import { awaitingReplySince, awaitingReplySinceSql, waitingInternalSince, waitingInternalSinceSql } from './case-rules.js';
import { NotificationsService } from './notifications.service.js';
import { SettingsService } from './settings.service.js';

/** History a customer may read (and receive in an export): what the customer's own screens already show (RULE-SUP-04). */
const CUSTOMER_VISIBLE_EVENT_TYPES = new Set<CaseEvent['type']>(['case_created', 'status_changed', 'case_resolved', 'case_reopened', 'case_closed', 'follow_up_created', 'reminder_sent']);

const OPEN = [...OPEN_CASE_STATUSES];

type EventActor = { actorType: 'customer' | 'staff' | 'system'; actorId: string };

/**
 * Case domain: creation, conversation, queues, lifecycle, collaboration, closure and incidents.
 *
 * Concurrency rule (Cycle Audit 1, FND-0009): every change to a case happens inside one transaction that first
 * locks and re-reads the row (`mutate`). Checks made on a row read outside the transaction are only fast
 * failures; the decision that is written always comes from the locked row, so two agents cannot both take a
 * case, a closure cannot record history on a case a customer just reactivated, and a reply cannot be lost
 * against a racing resolution. Live events are published only after the transaction committed.
 */
@Injectable()
export class CasesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly events: CaseEventBus,
    private readonly attachments: AttachmentsService,
    @Inject(STAFF_DIRECTORY) private readonly staffDirectory: StaffDirectory,
    @Inject(ORBIT_RECORDS) private readonly orbit: OrbitRecordsPort,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  // ---------- Customer ----------

  /**
   * Sending the first message creates the case. `clientMessageId` is the customer's idempotency key for the
   * creation itself (stored on the case — FND-0010): a retry returns the same case, never a second one.
   */
  async createCase(customer: CustomerActor, input: CreateCaseInput): Promise<CustomerCaseDetail> {
    if (input.clientMessageId) {
      const existing = await this.findCaseByClientMessage(customer.id, input.clientMessageId);
      if (existing) return this.customerDetail(await this.assertRootCase(existing));
    }
    // Contextual entry (§4.2): capture what the record looked like now; an unavailable answer still opens the
    // case — as an investigation, with the reason on the card (RULE-SUP-07, §14 item 7).
    const record = input.record ? await this.captureRecord(customer, input.record) : null;
    const complaintDeadlineAt = input.category === 'formal_complaint' ? this.complaintDeadline(new Date(), await this.operationTimezone()) : null;
    try {
      const { row, message, linked } = await this.db.transaction(async (tx) => {
        const now = new Date();
        const [created] = await tx
          .insert(supportCases)
          .values({
            customerId: customer.id,
            subject: input.subject ?? deriveSubject(input.message),
            category: input.category,
            complaintDeadlineAt,
            clientMessageId: input.clientMessageId ?? null,
            ...(record
              ? {
                  recordKind: record.kind,
                  recordReference: record.reference,
                  recordCapturedAt: new Date(record.capturedAt),
                  recordSnapshot: (record.snapshot as unknown as Record<string, unknown> | null) ?? null,
                  recordLookupReason: record.lookupReason,
                }
              : {}),
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
        // Files attached before the case existed join its first message (PH-9.3, BL-010).
        const linkedRows = await this.attachments.linkStaged(tx, customer, created.id, first.id, input.attachmentIds ?? []);
        await tx.insert(caseEvents).values({
          caseId: created.id,
          type: 'case_created',
          actorType: 'customer',
          actorId: customer.id,
          data: {
            category: input.category,
            identitySource: customer.source,
            ...(record ? { record: { kind: record.kind, reference: record.reference, snapshotCaptured: record.snapshot !== null, lookupReason: record.lookupReason } } : {}),
          },
          createdAt: now,
        });
        return { row: created, message: first, linked: linkedRows };
      });
      this.publishCaseUpdated(row);
      this.publishMessage(row, toMessage(message, linked.map(toAttachment)));
      await this.noticeOutsideHours(row.id);
      return this.customerDetail(row);
    } catch (error) {
      // Two retries raced past the lookup: the unique index kept one case; return it (RULE-SUP-03).
      if (input.clientMessageId && isUniqueViolation(error)) {
        const existing = await this.findCaseByClientMessage(customer.id, input.clientMessageId);
        if (existing) return this.customerDetail(await this.assertRootCase(existing));
      }
      throw error;
    }
  }

  async listCustomerCases(customer: CustomerActor): Promise<CustomerCaseSummary[]> {
    const rows = await this.db
      .select()
      .from(supportCases)
      .where(eq(supportCases.customerId, customer.id))
      .orderBy(desc(supportCases.lastMessageAt));
    return (await this.withUnread(rows, 'customer')).map(toCustomerCaseSummary);
  }

  async getCustomerCase(customer: CustomerActor, caseId: string): Promise<CustomerCaseDetail> {
    return this.customerDetail(await this.requireCustomerCase(customer, caseId));
  }

  /** The customer opened the conversation: everything received so far counts as read (§4.3 unread state). */
  async markCustomerRead(customer: CustomerActor, caseId: string): Promise<CustomerCaseSummary> {
    const row = await this.requireCustomerCase(customer, caseId);
    await this.notifications.markRead(customer, { caseId: row.id }); // the conversation is on screen: its notifications are read (PH-6.1)
    const [updated] = await this.db
      .update(supportCases)
      .set({ customerLastReadAt: new Date() })
      .where(eq(supportCases.id, row.id))
      .returning();
    this.publishCaseUpdated(updated);
    return toCustomerCaseSummary(await this.summaryOf(updated, 'customer'));
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
      if (existing) return this.customerDetail(this.assertFollowUpOf(existing, parent));
    }
    const parentReference = formatCaseReference(parent.referenceNumber);
    try {
      const timezone = await this.operationTimezone();
      const { child, firstMessage } = await this.db.transaction(async (tx) => {
        const lockedParent = await this.lock(tx, parent.id);
        if (lockedParent.status !== 'closed') throw new ConflictException('case_not_closed');
        const now = new Date();
        const [created] = await tx
          .insert(supportCases)
          .values({
            customerId: customer.id,
            subject: deriveSubject(input.message),
            category: lockedParent.category,
            complaintDeadlineAt: lockedParent.category === 'formal_complaint' ? this.complaintDeadline(now, timezone) : null,
            parentCaseId: lockedParent.id,
            clientMessageId: input.clientMessageId ?? null,
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
          systemKind: 'follow_up_of',
          systemData: { reference: parentReference },
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
            data: { parentCaseId: lockedParent.id, parentReference },
            createdAt: now,
          },
          {
            caseId: lockedParent.id,
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
      await this.noticeOutsideHours(child.id); // a follow-up written at night is told the same as a new case (FND-0042)
      return this.customerDetail(child);
    } catch (error) {
      if (input.clientMessageId && isUniqueViolation(error)) {
        const existing = await this.findCaseByClientMessage(customer.id, input.clientMessageId);
        if (existing) return this.customerDetail(this.assertFollowUpOf(existing, parent));
      }
      throw error;
    }
  }

  async postCustomerMessage(customer: CustomerActor, caseId: string, input: PostMessageInput): Promise<CaseMessage> {
    const row = await this.requireCustomerCase(customer, caseId);
    // A closed case takes no more messages: the customer continues through a linked follow-up (§7.3).
    if (row.status === 'closed') throw new ConflictException('case_closed');
    if (input.clientMessageId) {
      const duplicate = await this.findMessageByClientId(row.id, 'customer', customer.id, input.clientMessageId);
      if (duplicate) return this.messageWithAttachments(duplicate);
    }
    return this.onceByClientMessageId(row.id, 'customer', customer.id, input.clientMessageId, () =>
      this.insertCustomerMessage(customer, row.id, input),
    );
  }

  private async insertCustomerMessage(customer: CustomerActor, caseId: string, input: PostMessageInput): Promise<CaseMessage> {
    const { message, updated, linked } = await this.mutate(caseId, async (tx, row) => {
      if (row.status === 'closed') throw new ConflictException('case_closed');
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

      const patch: Partial<SupportCaseRow> = { updatedAt: now, lastMessageAt: now, lastCustomerMessageAt: now, reminderSentAt: null, waitingCustomerSince: null };
      if (row.status === 'resolved') {
        // §7.2 simple rule: any customer message reactivates a resolved case, whatever it says.
        Object.assign(patch, await this.exitResolved(tx, row, 'in_progress', { actorType: 'customer', actorId: customer.id }, now));
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
    await this.noticeOutsideHours(updated.id);
    return dto;
  }

  /**
   * Outside the configured schedule the conversation says so (context §4.4, RULE-SUP-08): a system message with
   * the next attention period, at most once per case per 12 h, plus an `outside_hours` notification. Never a
   * staff reply, so it does not count as a human response (§14). Errors here never fail the customer's message.
   */
  private async noticeOutsideHours(caseId: string): Promise<void> {
    try {
      const availability = await this.settings.availability();
      if (availability.openNow) return;
      const result = await this.mutate(caseId, async (tx, row) => {
        const now = new Date();
        if (row.outsideHoursNotifiedAt && now.getTime() - row.outsideHoursNotifiedAt.getTime() < 12 * 3_600_000) return null;
        const next = availability.nextOpening ? ` Próximo atendimento: ${WEEKDAY_PT[availability.nextOpening.weekday]} às ${availability.nextOpening.open}.` : '';
        const [notice] = await tx
          .insert(caseMessages)
          .values({ caseId: row.id, authorType: 'system', authorId: 'system', systemKind: 'outside_hours', systemData: availability.nextOpening ? { weekday: availability.nextOpening.weekday, open: availability.nextOpening.open, ...(availability.nextOpeningAt ? { nextOpeningAt: availability.nextOpeningAt } : {}) } : {}, body: `Fora do horário de atendimento. Registramos sua mensagem; ela será atendida por uma pessoa.${next}`, createdAt: now })
          .returning();
        const [changed] = await tx.update(supportCases).set({ outsideHoursNotifiedAt: now, lastMessageAt: now }).where(eq(supportCases.id, row.id)).returning();
        await this.notifications.record(tx, row.customerId, row.id, 'outside_hours', now);
        return { notice, changed };
      });
      if (result) {
        this.publishMessage(result.changed, toMessage(result.notice));
        this.publishCaseUpdated(result.changed);
      }
    } catch (error) {
      console.warn('outside-hours notice skipped', error instanceof Error ? error.message : error);
    }
  }

  // ---------- Staff ----------

  /**
   * Queue views (context §5.2, PH-5.1): open views surface the oldest unanswered customer message first; the
   * waiting views the oldest wait first; resolved and closed history newest first. Offset pagination.
   */
  async listStaffCases(
    staff: StaffActor,
    view: StaffQueueView,
    page: Pick<StaffListQuery, 'limit' | 'offset'> = { limit: STAFF_LIST_LIMITS.default, offset: 0 },
    filters: Pick<StaffListQuery, 'q' | 'category' | 'priority' | 'agentId'> = {},
  ): Promise<CaseSummary[]> {
    const open = inArray(supportCases.status, OPEN);
    // NULLS LAST: cases with an unanswered customer message come first, oldest first; the rest by latest activity.
    const awaitingFirst = sql`${awaitingReplySinceSql} asc nulls last`;
    const where =
      view === 'unassigned'
        ? and(open, isNull(supportCases.assignedAgentId))
        : view === 'mine'
          ? and(open, eq(supportCases.assignedAgentId, staff.id))
          : view === 'active'
            ? open
            : view === 'waiting_internal'
              ? // A team owes an answer — status or an open consultation — exactly as supervision counts it (FND-0084).
                and(open, sql`(${waitingInternalSinceSql}) is not null`)
              : eq(supportCases.status, view);
    const order =
      view === 'unassigned'
        ? [asc(supportCases.createdAt)]
        : view === 'mine' || view === 'active'
          ? [awaitingFirst, desc(supportCases.lastMessageAt)]
          : view === 'waiting_customer'
            ? [asc(supportCases.lastStaffMessageAt), asc(supportCases.updatedAt)]
            : view === 'waiting_internal'
              ? [sql`${waitingInternalSinceSql} asc`, asc(supportCases.updatedAt)]
              : view === 'resolved'
                ? [desc(supportCases.resolvedAt)]
                : [desc(supportCases.closedAt)];
    const rows = await this.db
      .select()
      .from(supportCases)
      .where(and(where, ...searchClauses(filters)))
      .orderBy(...order)
      .limit(page.limit)
      .offset(page.offset);
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
    return { ...summary, messages, events, consultations, record: toCaseRecord(row) };
  }

  // ---------- Records (PH-4.2, §4.2): the case remembers what it is about ----------

  /** The customer's open case per record, so the UI can offer to continue it instead of opening a duplicate (§4.2). */
  async activeCasesByRecord(customer: CustomerActor): Promise<Map<string, { id: string; reference: string }>> {
    const rows = await this.db
      .select({ id: supportCases.id, referenceNumber: supportCases.referenceNumber, kind: supportCases.recordKind, ref: supportCases.recordReference })
      .from(supportCases)
      .where(and(eq(supportCases.customerId, customer.id), inArray(supportCases.status, OPEN), ne(supportCases.recordKind, '')))
      .orderBy(asc(supportCases.createdAt));
    const map = new Map<string, { id: string; reference: string }>();
    for (const row of rows) {
      if (!row.kind || !row.ref) continue;
      const key = `${row.kind}:${row.ref}`;
      if (!map.has(key)) map.set(key, { id: row.id, reference: formatCaseReference(row.referenceNumber) });
    }
    return map;
  }

  /** Current Orbit state of the record a case is about, for the staff context (null when the case has none). */
  async currentRecord(row: SupportCaseRow): Promise<ReturnType<OrbitRecordsPort['getRecord']> | null> {
    if (!row.recordKind || !row.recordReference) return null;
    return this.orbit.getRecord(row.customerId, row.recordKind as OrbitRecordKind, row.recordReference);
  }

  private async captureRecord(customer: CustomerActor, ref: CaseRecordRef): Promise<CaseRecord> {
    const lookup = await this.orbit.getRecord(customer.id, ref.kind, ref.reference);
    return {
      kind: ref.kind,
      reference: ref.reference,
      capturedAt: lookup.fetchedAt,
      snapshot: lookup.state === 'available' ? lookup.data : null,
      lookupReason: lookup.state === 'available' ? null : lookup.reason,
    };
  }

  // ---------- Internal collaboration (PH-3.2): never visible to customers (RULE-SUP-04) ----------

  /** An internal note: a message only staff can see. It does not change the case's customer-facing timeline. */
  async postInternalNote(staff: StaffActor, caseId: string, input: PostNoteInput): Promise<CaseMessage> {
    const row = await this.requireCase(caseId);
    this.assertMayWorkComplaint(row, staff);
    // A retried note returns the stored one instead of a second copy, like replies do (RULE-SUP-03, BL-013).
    if (input.clientMessageId) {
      const duplicate = await this.findMessageByClientId(row.id, 'staff', staff.id, input.clientMessageId);
      if (duplicate) return this.sameNote(duplicate);
    }
    return this.onceByClientMessageId(row.id, 'staff', staff.id, input.clientMessageId, async () => {
      const { note, updated } = await this.mutate(caseId, async (tx, locked) => {
        if (locked.status === 'closed') throw new ConflictException('case_closed');
        return this.insertNote(tx, staff, locked, input.body, new Date(), input.clientMessageId);
      });
      const dto = toMessage(note);
      this.publishMessage(updated, dto); // customer streams filter internal visibility
      return dto;
    }).then((message) => (message.visibility === 'internal' ? message : this.sameNote(message)));
  }

  /** A key the author already used for a public reply on this case cannot be replayed as a note: that would hide what was sent. */
  private sameNote(message: CaseMessageRow | CaseMessage): CaseMessage {
    if (message.visibility !== 'internal') throw new ConflictException('client_message_id_reused');
    return 'attachments' in message ? message : toMessage(message);
  }

  /** Ask another team; the owner stays responsible for the customer and the case waits for the internal team. */
  async requestConsultation(staff: StaffActor, caseId: string, input: RequestConsultationInput): Promise<CaseConsultation> {
    this.assertMay(await this.requireCase(caseId), staff, 'consult');
    const { consultation, updated } = await this.mutate(caseId, async (tx, row) => {
      if (row.status === 'closed') throw new ConflictException('case_closed');
      this.assertMay(row, staff, 'consult');
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
        const patch: Partial<SupportCaseRow> = { status: 'waiting_internal', updatedAt: now, waitingInternalSince: now };
        if (current.status === 'resolved') {
          // Consulting a team on a resolved case reopens it (§7.2) — consistently with every other exit (FND-0013).
          Object.assign(patch, await this.exitResolved(tx, current, 'waiting_internal', { actorType: 'staff', actorId: staff.id }, now));
        } else {
          await tx.insert(caseEvents).values(statusChange(current, 'waiting_internal', staff.id, 'staff', now));
        }
        [changed] = await tx.update(supportCases).set(patch).where(eq(supportCases.id, current.id)).returning();
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
    if (row.status === 'closed') throw new ConflictException('case_closed');
    const { consultation, updated } = await this.mutate(caseId, async (tx, locked) => {
      // A closed case is final: nothing is written to it (FND-0008).
      if (locked.status === 'closed') throw new ConflictException('case_closed');
      const now = new Date();
      const [answered] = await tx
        .update(caseConsultations)
        .set({ status: 'answered', answer: input.answer, answeredById: staff.id, answeredByName: staff.displayName, answeredAt: now })
        .where(and(eq(caseConsultations.id, existing.id), eq(caseConsultations.status, 'open')))
        .returning();
      if (!answered) throw new ConflictException('consultation_already_answered');
      await tx.insert(caseEvents).values({
        caseId: locked.id,
        type: 'consultation_answered',
        actorType: 'staff',
        actorId: staff.id,
        data: { consultationId: existing.id, team: existing.team, answeredByName: staff.displayName },
        createdAt: now,
      });
      const open = await this.countOpenConsultations(tx, locked.id);
      let changed = locked;
      if (open === 0 && locked.status === 'waiting_internal') {
        await tx.insert(caseEvents).values(statusChange(locked, 'in_progress', staff.id, 'staff', now));
        [changed] = await tx.update(supportCases).set({ status: 'in_progress', updatedAt: now }).where(eq(supportCases.id, locked.id)).returning();
      } else {
        [changed] = await tx.update(supportCases).set({ updatedAt: now }).where(eq(supportCases.id, locked.id)).returning();
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

  private async countOpenConsultations(tx: Db, caseId: string): Promise<number> {
    const [{ open }] = await tx
      .select({ open: count() })
      .from(caseConsultations)
      .where(and(eq(caseConsultations.caseId, caseId), eq(caseConsultations.status, 'open')));
    return Number(open);
  }

  /** Staff opened the conversation: customer messages received so far count as read (a complaint's marker moves for its supervisors only). */
  async markStaffRead(staff: StaffActor, caseId: string): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    this.assertMayWorkComplaint(row, staff);
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
    this.assertMay(row, staff, 'close');
    const updated = await this.closeRow(row.id, 'staff', { actorType: 'staff', actorId: staff.id }, new Date(), (locked) => this.assertMay(locked, staff, 'close'));
    if (!updated) throw new ConflictException('case_not_resolved'); // reactivated between the check and the lock
    return this.summaryOf(updated);
  }

  /**
   * Closes resolved cases whose latest resolution is older than the follow-up window (working default 7 days,
   * context §13.1). Idempotent; returns how many were actually closed. Called by the closure job and by tests.
   */
  async closeExpired(now = new Date(), windowDays = followUpWindowDays()): Promise<number> {
    const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const expired = await this.db
      .select({ id: supportCases.id })
      .from(supportCases)
      .where(and(eq(supportCases.status, 'resolved'), lt(supportCases.resolvedAt, cutoff)));
    let closed = 0;
    for (const { id } of expired) {
      if (await this.closeRow(id, 'auto_window', { actorType: 'system', actorId: 'closure-job' }, now)) closed += 1;
    }
    return closed;
  }

  /**
   * Closes one case if — under the lock — it is still `resolved`. Returns null otherwise: no event is written and
   * nothing is published for a closure that did not happen (RULE-SUP-09, FND-0009).
   */
  private async closeRow(caseId: string, reason: 'auto_window' | 'staff', actor: EventActor, now = new Date(), guard?: (row: SupportCaseRow) => void): Promise<SupportCaseRow | null> {
    const updated = await this.mutate(caseId, async (tx, row) => {
      if (row.status !== 'resolved') return null;
      guard?.(row);
      await tx.insert(caseEvents).values([
        statusChange(row, 'closed', actor.actorId, actor.actorType, now),
        { caseId: row.id, type: 'case_closed', actorType: actor.actorType, actorId: actor.actorId, data: { reason }, createdAt: now },
      ]);
      const [changed] = await tx
        .update(supportCases)
        .set({ status: 'closed', closedAt: now, closedReason: reason, updatedAt: now })
        .where(eq(supportCases.id, row.id))
        .returning();
      await this.notifications.record(tx, row.customerId, row.id, 'closed', now);
      return changed;
    });
    if (updated) this.publishCaseUpdated(updated);
    return updated;
  }

  async takeCase(staff: StaffActor, caseId: string): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    this.assertMayWorkComplaint(row, staff);
    if (!OPEN.includes(row.status)) throw new ConflictException('case_not_open');
    if (row.assignedAgentId && row.assignedAgentId !== staff.id) throw new ConflictException('case_assigned_to_other');
    if (row.assignedAgentId === staff.id) return this.summaryOf(row);
    const { updated, changed } = await this.mutate(caseId, async (tx, locked) => {
      this.assertMayWorkComplaint(locked, staff); // reclassified between the check and the lock
      if (!OPEN.includes(locked.status)) throw new ConflictException('case_not_open');
      if (locked.assignedAgentId && locked.assignedAgentId !== staff.id) throw new ConflictException('case_assigned_to_other');
      if (locked.assignedAgentId === staff.id) return { updated: locked, changed: false };
      const [assigned] = await this.assign(tx, locked, staff, new Date());
      return { updated: assigned, changed: true };
    });
    if (changed) this.publishCaseUpdated(updated);
    return this.summaryOf(updated);
  }

  async postStaffMessage(staff: StaffActor, caseId: string, input: PostMessageInput): Promise<CaseMessage> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    this.assertMayWorkComplaint(row, staff);
    if (input.clientMessageId) {
      const duplicate = await this.findMessageByClientId(row.id, 'staff', staff.id, input.clientMessageId);
      if (duplicate) return this.sameReply(await this.messageWithAttachments(duplicate));
    }
    return this.onceByClientMessageId(row.id, 'staff', staff.id, input.clientMessageId, () => this.insertStaffMessage(staff, row.id, input)).then((message) => this.sameReply(message));
  }

  /** A key the author used for an internal note cannot be replayed as a public reply: the reply would be lost while reported sent (FND-0082). */
  private sameReply(message: CaseMessage): CaseMessage {
    if (message.visibility !== 'public') throw new ConflictException('client_message_id_reused');
    return message;
  }

  private async insertStaffMessage(staff: StaffActor, caseId: string, input: PostMessageInput): Promise<CaseMessage> {
    const { message, updated, linked } = await this.mutate(caseId, async (tx, row) => {
      if (row.status === 'closed') throw new ConflictException('case_closed');
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
      // Writing to a waiting customer restates the request: the reminder period starts again (FND-0033).
      const waiting: Partial<SupportCaseRow> = current.status === 'waiting_customer' ? { waitingCustomerSince: now, reminderSentAt: null } : {};
      const [changed] = await tx
        .update(supportCases)
        .set({ updatedAt: now, lastMessageAt: now, lastStaffMessageAt: now, ...waiting })
        .where(eq(supportCases.id, current.id))
        .returning();
      await this.notifications.record(tx, row.customerId, row.id, 'staff_reply', now); // PH-6.1: once per committed reply
      return { message: inserted, updated: changed, linked: linkedRows };
    });
    const dto = toMessage(message, linked.map(toAttachment));
    this.publishMessage(updated, dto);
    this.publishCaseUpdated(updated);
    return dto;
  }

  /**
   * Concurrent retries of the same send can both pass the duplicate lookup; the unique index keeps one row
   * and the loser returns the winner's message instead of failing (RULE-SUP-03, FND-0005). The key is scoped to
   * the case and the author (FND-0010), so a key reused on another case stores a new message there.
   */
  private async onceByClientMessageId(
    caseId: string,
    authorType: MessageAuthorType,
    authorId: string,
    clientMessageId: string | undefined,
    insert: () => Promise<CaseMessage>,
  ): Promise<CaseMessage> {
    try {
      return await insert();
    } catch (error) {
      if (clientMessageId && isUniqueViolation(error)) {
        const existing = await this.findMessageByClientId(caseId, authorType, authorId, clientMessageId);
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
    this.assertMay(row, staff, 'link_incident');
    let incident: IncidentRow | null = null;
    if (incidentId) {
      incident = await this.requireIncident(incidentId);
      if (incident.status !== 'open') throw new ConflictException('incident_resolved');
    }
    if (row.incidentId === incidentId) return this.summaryOf(row);
    const { updated, changed } = await this.mutate(caseId, async (tx, locked) => {
      if (locked.status === 'closed') throw new ConflictException('case_closed');
      this.assertMay(locked, staff, 'link_incident');
      if (locked.incidentId === incidentId) return { updated: locked, changed: false };
      const now = new Date();
      await tx.insert(caseEvents).values({
        caseId: locked.id,
        type: 'incident_linked',
        actorType: 'staff',
        actorId: staff.id,
        data: incident
          ? { incidentId: incident.id, title: incident.title, previousIncidentId: locked.incidentId }
          : { incidentId: null, unlinked: true, previousIncidentId: locked.incidentId },
        createdAt: now,
      });
      const [next] = await tx.update(supportCases).set({ incidentId, updatedAt: now }).where(eq(supportCases.id, locked.id)).returning();
      return { updated: next, changed: true };
    });
    if (changed) this.publishCaseUpdated(updated);
    return this.summaryOf(updated);
  }

  /**
   * One internal note delivered to every linked open case — the "coordinated update" of §5.4. Atomic (FND-0015).
   * A linked formal complaint receives it only from someone who may work complaints (DEC-0041; CLOSING FND-0106).
   */
  async broadcastIncidentNote(staff: StaffActor, incidentId: string, input: IncidentNoteInput): Promise<{ delivered: number; skippedComplaints: number }> {
    const incident = await this.requireIncident(incidentId);
    const { notes, skippedComplaints } = await this.noteLinkedOpenCases(incident, staff, `[Incidente “${incident.title}”] ${input.body}`);
    for (const { note, updated } of notes) this.publishMessage(updated, toMessage(note));
    return { delivered: notes.length, skippedComplaints };
  }

  /** Marks the incident resolved and tells every linked open case's team — without touching any case status. */
  async resolveIncident(staff: StaffActor, incidentId: string): Promise<Incident> {
    const incident = await this.requireIncident(incidentId);
    if (incident.status === 'resolved') throw new ConflictException('incident_already_resolved');
    const advisory = `[Incidente “${incident.title}”] Incidente marcado como resolvido por ${staff.displayName}. Confirme se o caso deste cliente está de fato resolvido antes de encerrá-lo.`;
    const { updated, notes } = await this.db.transaction(async (tx) => {
      const [resolved] = await tx
        .update(incidents)
        .set({ status: 'resolved', resolvedAt: new Date(), resolvedById: staff.id })
        .where(and(eq(incidents.id, incident.id), eq(incidents.status, 'open')))
        .returning();
      if (!resolved) throw new ConflictException('incident_already_resolved');
      return { updated: resolved, notes: (await this.noteLinkedOpenCases(incident, staff, advisory, tx)).notes };
    });
    for (const { note, updated: row } of notes) this.publishMessage(row, toMessage(note));
    const counts = await this.linkedCaseCounts([incident.id]);
    return toIncident(updated, counts.get(incident.id) ?? 0);
  }

  /** Inserts the same internal note on every open case linked to the incident, inside one transaction. */
  private async noteLinkedOpenCases(
    incident: IncidentRow,
    staff: StaffActor,
    body: string,
    outerTx?: Db,
  ): Promise<{ notes: Array<{ note: CaseMessageRow; updated: SupportCaseRow }>; skippedComplaints: number }> {
    const work = async (tx: Db) => {
      const linked = await tx
        .select()
        .from(supportCases)
        .where(and(eq(supportCases.incidentId, incident.id), inArray(supportCases.status, OPEN)))
        .for('update');
      const now = new Date();
      const notes: Array<{ note: CaseMessageRow; updated: SupportCaseRow }> = [];
      let skippedComplaints = 0;
      for (const row of linked) {
        if (row.category === 'formal_complaint' && !staffMayWorkComplaint(staff.role)) skippedComplaints += 1;
        else notes.push(await this.insertNote(tx, staff, row, body, now));
      }
      return { notes, skippedComplaints };
    };
    return outerTx ? work(outerTx) : this.db.transaction(work);
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
   * The target must exist in the staff directory: a case transferred to nobody would leave every queue (FND-0007).
   */
  async assignCase(staff: StaffActor, caseId: string, input: AssignCaseInput): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    this.assertMayReassign(row, staff);
    if (input.agentId !== null && !(await this.staffDirectory.isKnownStaff(input.agentId))) {
      throw new BadRequestException({ error: 'unknown_agent', agentId: input.agentId });
    }
    const target = input.agentId !== null ? await this.staffDirectory.roleOf(input.agentId) : undefined;
    this.assertComplaintTarget(row, target);
    if (row.assignedAgentId === input.agentId) return this.summaryOf(row);
    const { updated, changed } = await this.mutate(caseId, async (tx, locked) => {
      if (locked.status === 'closed') throw new ConflictException('case_closed');
      this.assertMayReassign(locked, staff);
      this.assertComplaintTarget(locked, target); // reclassified between the check and the lock (CLOSING FND-0107)
      if (locked.assignedAgentId === input.agentId) return { updated: locked, changed: false };
      const now = new Date();
      await tx.insert(caseEvents).values({
        caseId: locked.id,
        type: 'case_assigned',
        actorType: 'staff',
        actorId: staff.id,
        data: input.agentId
          ? { agentId: input.agentId, previousAgentId: locked.assignedAgentId, transferredByName: staff.displayName }
          : { agentId: null, previousAgentId: locked.assignedAgentId, released: true, releasedByName: staff.displayName },
        createdAt: now,
      });
      const [next] = await tx
        .update(supportCases)
        .set({ assignedAgentId: input.agentId, updatedAt: now })
        .where(eq(supportCases.id, locked.id))
        .returning();
      return { updated: next, changed: true };
    });
    if (changed) this.publishCaseUpdated(updated);
    return this.summaryOf(updated);
  }

  private assertMayReassign(row: SupportCaseRow, staff: StaffActor): void {
    this.assertMay(row, staff, 'transfer');
  }

  /** A formal complaint may only be handed to someone who may work it (DEC-0039 g). */
  private assertComplaintTarget(row: SupportCaseRow, target: { role: StaffRole } | undefined): void {
    if (row.category === 'formal_complaint' && target && !staffMayWorkComplaint(target.role)) throw new BadRequestException({ error: 'supervisor_required' });
  }

  /**
   * The role model (PH-7.2, DEC-0029): `staffMay` in `@orbit-support/shared` is the single table the web mirrors.
   * Checked before the transaction (fast failure) and again under the lock (the owner may have just changed).
   */
  private assertMay(row: SupportCaseRow, staff: StaffActor, action: StaffAction): void {
    this.assertMayWorkComplaint(row, staff);
    if (!staffMay(staff.role, action, caseOwnership(row.assignedAgentId, staff.id))) throw new ForbiddenException('not_case_owner');
  }

  /** The complaint rule for routes outside this service (staff uploads). */
  assertStaffMayWork(row: SupportCaseRow, staff: StaffActor): void {
    this.assertMayWorkComplaint(row, staff);
  }

  /** A formal complaint is worked by supervisors and admins only (DEC-0039 g); the web mirrors `staffMayWorkComplaint`. */
  private assertMayWorkComplaint(row: SupportCaseRow, staff: StaffActor): void {
    if (row.category === 'formal_complaint' && !staffMayWorkComplaint(staff.role)) throw new ForbiddenException('supervisor_required');
  }

  /** The operation's time zone, read before a transaction opens: a query inside one deadlocks PGlite's single connection. */
  private async operationTimezone(): Promise<string> {
    return (await this.settings.get()).timezone;
  }

  /** Five business days of the operation's zone from `from` (DEC-0039 g). */
  private complaintDeadline(from: Date, timezone: string): Date {
    return businessDaysAfter(from, COMPLAINT_DEADLINE_BUSINESS_DAYS, timezone);
  }

  /** Priority and category corrections, each recorded as an attributable event (§5.4, RULE-SUP-09). */
  async updateAttributes(staff: StaffActor, caseId: string, input: UpdateCaseInput): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    this.assertMay(row, staff, 'edit_attributes');
    const timezone = input.category ? await this.operationTimezone() : null;
    // The owner's role, read before the transaction: a case that becomes a complaint leaves an owner who may not work one.
    const owner = input.category === 'formal_complaint' && row.assignedAgentId ? await this.staffDirectory.roleOf(row.assignedAgentId) : undefined;
    const updated = await this.mutate(caseId, async (tx, locked) => {
      if (locked.status === 'closed') throw new ConflictException('case_closed');
      this.assertMay(locked, staff, 'edit_attributes');
      const now = new Date();
      const patch: Partial<SupportCaseRow> = { updatedAt: now };
      if (input.category === 'formal_complaint' && locked.category !== 'formal_complaint' && locked.assignedAgentId) {
        if (locked.assignedAgentId !== row.assignedAgentId) throw new ConflictException('case_assignment_changed');
        if (owner && !staffMayWorkComplaint(owner.role)) {
          // Routed to a supervisor (DEC-0041): the agent could neither work nor release it (CLOSING FND-0107).
          patch.assignedAgentId = null;
          await tx.insert(caseEvents).values({
            caseId: locked.id,
            type: 'case_assigned',
            actorType: 'staff',
            actorId: staff.id,
            data: { agentId: null, previousAgentId: locked.assignedAgentId, released: true, releasedByName: staff.displayName, reason: 'formal_complaint' },
            createdAt: now,
          });
        }
      }
      if (input.priority && input.priority !== locked.priority) {
        patch.priority = input.priority;
        await tx.insert(caseEvents).values({
          caseId: locked.id,
          type: 'priority_changed',
          actorType: 'staff',
          actorId: staff.id,
          data: { from: locked.priority, to: input.priority },
          createdAt: now,
        });
      }
      if (input.category && input.category !== locked.category) {
        patch.category = input.category;
        // Becoming a formal complaint starts its deadline; leaving the category ends it (DEC-0039 g).
        patch.complaintDeadlineAt = input.category === 'formal_complaint' && timezone ? this.complaintDeadline(now, timezone) : null;
        await tx.insert(caseEvents).values({
          caseId: locked.id,
          type: 'category_changed',
          actorType: 'staff',
          actorId: staff.id,
          data: { from: locked.category, to: input.category },
          createdAt: now,
        });
      }
      const [changed] = await tx.update(supportCases).set(patch).where(eq(supportCases.id, locked.id)).returning();
      return changed;
    });
    this.publishCaseUpdated(updated);
    return this.summaryOf(updated);
  }

  // ---------- Lifecycle (PH-3.1): status means "work still required" (§7) ----------

  /**
   * Staff say what the case is waiting for. Acting on an unowned case makes the actor responsible
   * (RULE-SUP-02). `resolved` and `closed` have their own flows; `closed` cases do not move here.
   * Leaving `resolved` this way is a reopening and is recorded as one (FND-0013).
   */
  async setStatus(staff: StaffActor, caseId: string, target: StaffStatusTarget): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    this.assertMay(row, staff, 'set_status');
    const updated = await this.mutate(caseId, async (tx, locked) => {
      if (locked.status === 'closed') throw new ConflictException('case_closed');
      this.assertMay(locked, staff, 'set_status');
      const now = new Date();
      const current = locked.assignedAgentId ? locked : (await this.assign(tx, locked, staff, now))[0];
      if (current.status === target) return current;
      const patch: Partial<SupportCaseRow> = { status: target, updatedAt: now };
      // Each entry into `waiting_customer` is a new waiting period for the reminder (FND-0033).
      if (target === 'waiting_customer') Object.assign(patch, { waitingCustomerSince: now, reminderSentAt: null });
      // Each entry into `waiting_internal` starts the waiting-for-team age (PH-8.1, BL-021).
      if (target === 'waiting_internal') Object.assign(patch, { waitingInternalSince: now });
      if (current.status === 'resolved') {
        Object.assign(patch, await this.exitResolved(tx, current, target, { actorType: 'staff', actorId: staff.id }, now));
      } else {
        await tx.insert(caseEvents).values(statusChange(current, target, staff.id, 'staff', now));
      }
      const [changed] = await tx.update(supportCases).set(patch).where(eq(supportCases.id, current.id)).returning();
      if (target === 'waiting_customer') await this.notifications.record(tx, current.customerId, current.id, 'waiting_customer', now);
      return changed;
    });
    this.publishCaseUpdated(updated);
    return this.summaryOf(updated);
  }

  /**
   * A supported conclusion: reason code plus an explanation the customer reads in the conversation (§7.1).
   * Resolving changes nothing but the case itself (RULE-SUP-05). The customer can reactivate by replying.
   * A case is not resolved while a specialist consultation is still pending (§7.1, FND-0008).
   */
  async resolve(staff: StaffActor, caseId: string, input: ResolveCaseInput): Promise<CaseSummary> {
    const row = await this.requireCase(caseId);
    if (row.status === 'closed') throw new ConflictException('case_closed');
    if (row.status === 'resolved') throw new ConflictException('case_already_resolved');
    this.assertMay(row, staff, 'resolve');
    const { updated, message } = await this.mutate(caseId, async (tx, locked) => {
      if (locked.status === 'closed') throw new ConflictException('case_closed');
      if (locked.status === 'resolved') throw new ConflictException('case_already_resolved');
      this.assertMay(locked, staff, 'resolve');
      if ((await this.countOpenConsultations(tx, locked.id)) > 0) throw new ConflictException('consultations_open');
      const now = new Date();
      const current = locked.assignedAgentId ? locked : (await this.assign(tx, locked, staff, now))[0];
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
      await this.notifications.record(tx, current.customerId, current.id, 'resolved', now);
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

  /** Staff summaries for rows another service selected (supervision overview, PH-5.4). */
  summariesOf(rows: SupportCaseRow[]): Promise<CaseSummary[]> {
    return this.withUnread(rows, 'staff');
  }

  /**
   * One reminder per waiting period (PH-6.3, §7.4), decided on the locked row like every other change to a case
   * (DEC-0017, BL-022). Silence is never a solution: the case stays `waiting_customer`. Returns whether a reminder was recorded.
   */
  async remind(caseId: string, cutoff: Date, afterHours: number, now = new Date()): Promise<boolean> {
    return this.mutate(caseId, async (tx, locked) => {
      if (locked.status !== 'waiting_customer' || locked.reminderSentAt || !locked.waitingCustomerSince || locked.waitingCustomerSince >= cutoff) return false;
      await tx.insert(caseEvents).values({ caseId: locked.id, type: 'reminder_sent', actorType: 'system', actorId: 'reminder-job', data: { afterHours }, createdAt: now });
      await tx.update(supportCases).set({ reminderSentAt: now }).where(eq(supportCases.id, locked.id));
      await this.notifications.record(tx, locked.customerId, locked.id, 'reminder', now);
      return true;
    });
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

  /** Runs `fn` inside a transaction holding the row lock of the case; every decision uses the locked row. */
  private mutate<T>(caseId: string, fn: (tx: Db, row: SupportCaseRow) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => fn(tx, await this.lock(tx, caseId)));
  }

  private async lock(tx: Db, caseId: string): Promise<SupportCaseRow> {
    const [row] = await tx.select().from(supportCases).where(eq(supportCases.id, caseId)).limit(1).for('update');
    if (!row) throw new NotFoundException('case_not_found');
    return row;
  }

  /** Every exit from `resolved` clears the resolution and records a reopening with its actor (§7.2, RULE-SUP-09). */
  private async exitResolved(tx: Db, row: SupportCaseRow, to: CaseStatus, actor: EventActor, now: Date): Promise<Partial<SupportCaseRow>> {
    await tx.insert(caseEvents).values({
      caseId: row.id,
      type: 'case_reopened',
      actorType: actor.actorType,
      actorId: actor.actorId,
      data: { from: row.status, to },
      createdAt: now,
    });
    return { status: to, resolvedAt: null, resolutionReason: null };
  }

  private async insertNote(tx: Db, staff: StaffActor, row: SupportCaseRow, body: string, now: Date, clientMessageId?: string) {
    const [note] = await tx
      .insert(caseMessages)
      .values({
        caseId: row.id,
        authorType: 'staff',
        authorId: staff.id,
        authorName: staff.displayName,
        visibility: 'internal',
        body,
        clientMessageId: clientMessageId ?? null,
        createdAt: now,
      })
      .returning();
    const [updated] = await tx.update(supportCases).set({ updatedAt: now }).where(eq(supportCases.id, row.id)).returning();
    return { note, updated };
  }

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

  /** Customer detail: the customer projection of the summary plus the public conversation (RULE-SUP-04). */
  /**
   * One case as the customer may see it, plus the history the customer may see (PH-10.3 exports): public messages
   * and the customer-visible events only — never assignments, consultations, incidents or priority (CLOSING FND-0101).
   */
  async exportCase(customer: CustomerActor, row: SupportCaseRow): Promise<CustomerCaseDetail & { events: CustomerCaseEvent[] }> {
    if (row.customerId !== customer.id) throw new NotFoundException('case_not_found');
    const [detail, events] = await Promise.all([this.customerDetail(row), this.loadEvents(row.id)]);
    return { ...detail, events: events.filter((e) => CUSTOMER_VISIBLE_EVENT_TYPES.has(e.type)).map(({ actorId: _actorId, ...event }) => event) };
  }

  private async customerDetail(row: SupportCaseRow): Promise<CustomerCaseDetail> {
    const [messages, summary] = await Promise.all([this.loadMessages(row.id, true), this.summaryOf(row, 'customer')]);
    return { ...toCustomerCaseSummary(summary), messages, record: toCaseRecord(row) };
  }

  /** Summaries with viewer-dependent unread counts, the parent reference for follow-ups and the incident title. */
  private async withUnread(rows: SupportCaseRow[], viewer: 'customer' | 'staff'): Promise<CaseSummary[]> {
    const [unread, parents, incidentTitles, consultations] = await Promise.all([
      this.unreadCounts(rows.map((r) => r.id), viewer),
      this.parentReferences(rows),
      viewer === 'staff' ? this.incidentTitles(rows) : Promise.resolve(new Map<string, string>()),
      viewer === 'staff' ? this.oldestOpenConsultations(rows.map((r) => r.id)) : Promise.resolve(new Map<string, Date>()),
    ]);
    return rows.map((row) => toSummary(row, unread.get(row.id) ?? 0, parents.get(row.id) ?? null, incidentTitles.get(row.id) ?? null, consultations.get(row.id) ?? null));
  }

  /** Request time of each case's oldest open consultation (FND-0084: the summary's waiting-for-team age). */
  private async oldestOpenConsultations(caseIds: string[]): Promise<Map<string, Date>> {
    if (caseIds.length === 0) return new Map();
    const rows = await this.db
      .select({ caseId: caseConsultations.caseId, since: min(caseConsultations.requestedAt) })
      .from(caseConsultations)
      .where(and(inArray(caseConsultations.caseId, caseIds), eq(caseConsultations.status, 'open')))
      .groupBy(caseConsultations.caseId);
    return new Map(rows.filter((r) => r.since !== null).map((r) => [r.caseId, new Date(r.since as Date | string)]));
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

  /** The message a (case, author, key) triple already stored, if any — the idempotency lookup (FND-0010). */
  private async findMessageByClientId(
    caseId: string,
    authorType: MessageAuthorType,
    authorId: string,
    clientMessageId: string,
  ): Promise<CaseMessageRow | undefined> {
    const [row] = await this.db
      .select()
      .from(caseMessages)
      .where(
        and(
          eq(caseMessages.caseId, caseId),
          eq(caseMessages.authorType, authorType),
          eq(caseMessages.authorId, authorId),
          eq(caseMessages.clientMessageId, clientMessageId),
        ),
      )
      .limit(1);
    return row;
  }

  /** The case a customer already created with this key (root case or follow-up). */
  private async findCaseByClientMessage(customerId: string, clientMessageId: string): Promise<SupportCaseRow | undefined> {
    const [row] = await this.db
      .select()
      .from(supportCases)
      .where(and(eq(supportCases.customerId, customerId), eq(supportCases.clientMessageId, clientMessageId)))
      .limit(1);
    return row;
  }

  /** A creation key reused for a follow-up (or vice versa) is refused rather than answered with a foreign case. */
  private async assertRootCase(existing: SupportCaseRow): Promise<SupportCaseRow> {
    if (existing.parentCaseId !== null) throw new ConflictException('client_message_id_reused');
    return existing;
  }

  private assertFollowUpOf(existing: SupportCaseRow, parent: SupportCaseRow): SupportCaseRow {
    if (existing.parentCaseId !== parent.id) throw new ConflictException('client_message_id_reused');
    return existing;
  }
}

const WEEKDAY_PT: Record<string, string> = { mon: 'segunda-feira', tue: 'terça-feira', wed: 'quarta-feira', thu: 'quinta-feira', fri: 'sexta-feira', sat: 'sábado', sun: 'domingo' };

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
  return positiveNumberEnv('SUPPORT_FOLLOW_UP_WINDOW_DAYS', 7);
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

function toSummary(row: SupportCaseRow, unreadCount = 0, parentReference: string | null = null, incidentTitle: string | null = null, oldestOpenConsultation: Date | null = null): CaseSummary {
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
    recordKind: (row.recordKind as OrbitRecordKind | null) ?? null,
    recordReference: row.recordReference,
    awaitingReplySince: iso(awaitingReplySince(row)),
    // Stream events carry no consultations: they re-read the case, so the status-only value there is a hint (FND-0084).
    waitingInternalSince: iso(waitingInternalSince(row, oldestOpenConsultation)),
    complaintDeadlineAt: row.category === 'formal_complaint' ? iso(row.complaintDeadlineAt) : null,
  };
}

/** Search and filter clauses (PH-5.2): a reference-looking term matches the number exactly; anything else matches text. */
function searchClauses(filters: Pick<StaffListQuery, 'q' | 'category' | 'priority' | 'agentId'>) {
  const clauses = [];
  if (filters.q) {
    const term = filters.q.trim();
    const asReference = term.match(/^(?:SUP-)?0*(\d{1,9})$/i);
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    clauses.push(
      or(
        ...(asReference ? [eq(supportCases.referenceNumber, Number(asReference[1]))] : []),
        ilike(supportCases.customerId, like),
        ilike(supportCases.subject, like),
        ilike(supportCases.recordReference, like),
      ),
    );
  }
  if (filters.category) clauses.push(eq(supportCases.category, filters.category));
  if (filters.priority) clauses.push(eq(supportCases.priority, filters.priority));
  if (filters.agentId) clauses.push(filters.agentId === 'unassigned' ? isNull(supportCases.assignedAgentId) : eq(supportCases.assignedAgentId, filters.agentId));
  return clauses;
}

function toCaseRecord(row: SupportCaseRow): CaseRecord | null {
  if (!row.recordKind || !row.recordReference || !row.recordCapturedAt) return null;
  return {
    kind: row.recordKind as OrbitRecordKind,
    reference: row.recordReference,
    capturedAt: row.recordCapturedAt.toISOString(),
    snapshot: (row.recordSnapshot as unknown as OrbitRecord | null) ?? null,
    lookupReason: (row.recordLookupReason as OrbitUnavailableReason | null) ?? null,
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
    systemKind: (row.systemKind as SystemMessageKind | null) ?? null,
    systemData: row.systemData ?? null,
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
