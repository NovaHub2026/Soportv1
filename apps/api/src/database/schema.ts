import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  ACCESS_RECOVERY_STATUSES,
  ATTACHMENT_STATUSES,
  CASE_CATEGORIES,
  CONSULTATION_STATUSES,
  CONSULTATION_TEAMS,
  INCIDENT_STATUSES,
  CASE_EVENT_TYPES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  MESSAGE_AUTHOR_TYPES,
  MESSAGE_VISIBILITIES,
} from '@orbit-support/shared';

// PostgreSQL dialect (ADR-0003). Vocabulary comes from @orbit-support/shared so API, DB and web agree.
export const caseStatusEnum = pgEnum('case_status', CASE_STATUSES);
export const caseCategoryEnum = pgEnum('case_category', CASE_CATEGORIES);
export const casePriorityEnum = pgEnum('case_priority', CASE_PRIORITIES);
export const actorTypeEnum = pgEnum('actor_type', MESSAGE_AUTHOR_TYPES);
export const messageVisibilityEnum = pgEnum('message_visibility', MESSAGE_VISIBILITIES);
export const caseEventTypeEnum = pgEnum('case_event_type', CASE_EVENT_TYPES);
export const attachmentStatusEnum = pgEnum('attachment_status', ATTACHMENT_STATUSES);
export const consultationTeamEnum = pgEnum('consultation_team', CONSULTATION_TEAMS);
export const consultationStatusEnum = pgEnum('consultation_status', CONSULTATION_STATUSES);
export const incidentStatusEnum = pgEnum('incident_status', INCIDENT_STATUSES);
export const accessRecoveryStatusEnum = pgEnum('access_recovery_status', ACCESS_RECOVERY_STATUSES);

const tz = (name: string) => timestamp(name, { withTimezone: true });

/** One support matter (PROJECT_CONTEXT.md §7). `reference_number` feeds the customer-visible `SUP-000001`. */
export const supportCases = pgTable(
  'support_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referenceNumber: integer('reference_number').generatedAlwaysAsIdentity(),
    customerId: text('customer_id').notNull(),
    subject: text('subject').notNull(),
    category: caseCategoryEnum('category').notNull(),
    status: caseStatusEnum('status').notNull().default('new'),
    priority: casePriorityEnum('priority').notNull().default('normal'),
    assignedAgentId: text('assigned_agent_id'),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
    lastMessageAt: tz('last_message_at').notNull().defaultNow(),
    lastCustomerMessageAt: tz('last_customer_message_at'),
    lastStaffMessageAt: tz('last_staff_message_at'),
    /** Read markers (PH-2.2): unread = messages from the other side created after these. */
    customerLastReadAt: tz('customer_last_read_at'),
    staffLastReadAt: tz('staff_last_read_at'),
    resolvedAt: tz('resolved_at'),
    /** Reason code of the latest resolution (PH-3.1); the explanation is a public message. */
    resolutionReason: text('resolution_reason'),
    closedAt: tz('closed_at'),
    /** `auto_window` (follow-up window elapsed) or `staff` (PH-3.4). */
    closedReason: text('closed_reason'),
    /** The closed case this one continues (PH-3.4); self-reference kept nullable and non-cascading. */
    parentCaseId: uuid('parent_case_id'),
    /** Shared incident association (PH-3.5); unlinking sets null, deleting an incident is not supported. */
    incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'set null' }),
    /** The customer's idempotency key for creating this case (root or follow-up): a retry never opens a second one (FND-0010). */
    clientMessageId: text('client_message_id'),
    /** The Orbit record the case is about (PH-4.2, §4.2): kind + reference, and the snapshot captured at creation (§6.2). */
    recordKind: text('record_kind'),
    recordReference: text('record_reference'),
    recordCapturedAt: tz('record_captured_at'),
    recordSnapshot: jsonb('record_snapshot').$type<Record<string, unknown>>(),
    /** Why the snapshot is null: the adapter could not answer when the case was opened (RULE-SUP-07). */
    recordLookupReason: text('record_lookup_reason'),
    /** Last outside-hours system notice (PH-6.3): at most one per case per 12 h. */
    outsideHoursNotifiedAt: tz('outside_hours_notified_at'),
    /** Reminder sent for the current waiting-for-customer period; cleared when the customer replies (PH-6.3). */
    reminderSentAt: tz('reminder_sent_at'),
    /**
     * Start of the current waiting-for-customer period: set when the case enters `waiting_customer` or staff
     * write while it waits, cleared when the customer replies (Cycle Audit 2, FND-0033).
     */
    waitingCustomerSince: tz('waiting_customer_since'),
  },
  (t) => [
    uniqueIndex('support_cases_reference_number_uq').on(t.referenceNumber),
    uniqueIndex('support_cases_customer_client_message_uq')
      .on(t.customerId, t.clientMessageId)
      .where(sql`${t.clientMessageId} is not null`),
    index('support_cases_customer_idx').on(t.customerId, t.lastMessageAt),
    index('support_cases_queue_idx').on(t.status, t.assignedAgentId, t.createdAt),
    index('support_cases_record_idx').on(t.customerId, t.recordKind, t.recordReference),
    index('support_cases_resolved_idx').on(t.status, t.resolvedAt),
    index('support_cases_closed_idx').on(t.status, t.closedAt),
  ],
);

/** Conversation entries. `internal` visibility is a staff note and never leaves the staff surface (RULE-SUP-04). */
export const caseMessages = pgTable(
  'case_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => supportCases.id, { onDelete: 'cascade' }),
    authorType: actorTypeEnum('author_type').notNull(),
    authorId: text('author_id').notNull(),
    authorName: text('author_name'),
    visibility: messageVisibilityEnum('visibility').notNull().default('public'),
    body: text('body').notNull(),
    /** Client-generated id: a retried send must not duplicate the message (RULE-SUP-03). Unique per case and author (FND-0010). */
    clientMessageId: text('client_message_id'),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('case_messages_case_idx').on(t.caseId, t.createdAt),
    uniqueIndex('case_messages_case_author_client_message_uq')
      .on(t.caseId, t.authorType, t.authorId, t.clientMessageId)
      .where(sql`${t.clientMessageId} is not null`),
  ],
);

/** Attributable history of material actions on a case (RULE-SUP-09). Append-only by convention. */
export const caseEvents = pgTable(
  'case_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => supportCases.id, { onDelete: 'cascade' }),
    type: caseEventTypeEnum('type').notNull(),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: text('actor_id').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [index('case_events_case_idx').on(t.caseId, t.createdAt)],
);

/**
 * Files attached to messages (PH-2.3). Uploaded first (message_id null), linked when the message is sent.
 * Bytes live behind the storage port under `storage_key`; the row is the authority on who may read them.
 */
export const caseAttachments = pgTable(
  'case_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => supportCases.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => caseMessages.id, { onDelete: 'set null' }),
    uploaderType: actorTypeEnum('uploader_type').notNull(),
    uploaderId: text('uploader_id').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull(),
    status: attachmentStatusEnum('status').notNull().default('available'),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [index('case_attachments_case_idx').on(t.caseId, t.createdAt), index('case_attachments_message_idx').on(t.messageId)],
);

/**
 * A question from the support owner to another team (PH-3.2, context §5.3). The owner stays responsible
 * for the customer; the case waits for the internal team until every open consultation is answered.
 */
export const caseConsultations = pgTable(
  'case_consultations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => supportCases.id, { onDelete: 'cascade' }),
    team: consultationTeamEnum('team').notNull(),
    question: text('question').notNull(),
    status: consultationStatusEnum('status').notNull().default('open'),
    requestedById: text('requested_by_id').notNull(),
    requestedByName: text('requested_by_name'),
    requestedAt: tz('requested_at').notNull().defaultNow(),
    answeredById: text('answered_by_id'),
    answeredByName: text('answered_by_name'),
    answeredAt: tz('answered_at'),
    answer: text('answer'),
  },
  (t) => [index('case_consultations_case_idx').on(t.caseId, t.status)],
);

/** A shared incident several cases refer to (PH-3.5, context §5.4). Resolving it never resolves the cases. */
export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: incidentStatusEnum('status').notNull().default('open'),
  createdById: text('created_by_id').notNull(),
  createdByName: text('created_by_name'),
  createdAt: tz('created_at').notNull().defaultNow(),
  resolvedAt: tz('resolved_at'),
  resolvedById: text('resolved_by_id'),
});

/** Team-maintained reply templates (PH-5.3). Every change is attributed (RULE-SUP-09). */
export const savedReplies = pgTable('saved_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  category: caseCategoryEnum('category'),
  createdById: text('created_by_id').notNull(),
  createdByName: text('created_by_name'),
  updatedById: text('updated_by_id').notNull(),
  updatedByName: text('updated_by_name'),
  createdAt: tz('created_at').notNull().defaultNow(),
  updatedAt: tz('updated_at').notNull().defaultNow(),
});

/** Operating configuration (PH-5.4): one row, attributed. Absent row = working defaults (RULE-SUP-08). */
export const supportSettings = pgTable('support_settings', {
  id: text('id').primaryKey(),
  timezone: text('timezone').notNull(),
  schedule: jsonb('schedule').$type<Record<string, unknown>>().notNull(),
  attentionThresholdHours: integer('attention_threshold_hours').notNull(),
  followUpWindowDays: integer('follow_up_window_days').notNull(),
  emailDelayMinutes: integer('email_delay_minutes').notNull().default(15),
  reminderAfterHours: integer('reminder_after_hours').notNull().default(48),
  updatedById: text('updated_by_id').notNull(),
  updatedByName: text('updated_by_name'),
  updatedAt: tz('updated_at').notNull().defaultNow(),
});

/** In-product notifications for customers (PH-6.1): one row per customer-facing event; read when the case is opened. */
export const caseNotifications = pgTable(
  'case_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: text('customer_id').notNull(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => supportCases.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    createdAt: tz('created_at').notNull().defaultNow(),
    readAt: tz('read_at'),
    /** When the e-mail about it was handed to the notifier (or skipped for an opted-out customer) — PH-6.2. */
    emailedAt: tz('emailed_at'),
  },
  (t) => [index('case_notifications_customer_idx').on(t.customerId, t.readAt, t.createdAt), index('case_notifications_case_idx').on(t.caseId)],
);

/** What the (simulated) e-mail notifier sent (PH-6.2). The raw address is never stored; the body carries no case content. */
export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: text('customer_id').notNull(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => supportCases.id, { onDelete: 'cascade' }),
  notificationId: uuid('notification_id').references(() => caseNotifications.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  toMasked: text('to_masked').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  link: text('link').notNull(),
  delivery: text('delivery').notNull(),
  createdAt: tz('created_at').notNull().defaultNow(),
});

/** Per-customer notification preferences (PH-6.2). Absent row = e-mails on. */
export const customerPreferences = pgTable('customer_preferences', {
  customerId: text('customer_id').primaryKey(),
  emailNotifications: boolean('email_notifications').notNull().default(true),
  updatedAt: tz('updated_at').notNull().defaultNow(),
});

export type EmailOutboxRow = typeof emailOutbox.$inferSelect;

export type CaseNotificationRow = typeof caseNotifications.$inferSelect;
export type SupportSettingsRow = typeof supportSettings.$inferSelect;
export type SavedReplyRow = typeof savedReplies.$inferSelect;
export type SupportCaseRow = typeof supportCases.$inferSelect;
export type CaseAttachmentRow = typeof caseAttachments.$inferSelect;
export type CaseConsultationRow = typeof caseConsultations.$inferSelect;
export type IncidentRow = typeof incidents.$inferSelect;
export type CaseMessageRow = typeof caseMessages.$inferSelect;
export type CaseEventRow = typeof caseEvents.$inferSelect;

/**
 * Access recovery requests (PH-7.1, context §4.5): unverified contact + description from someone who cannot sign
 * in. Deliberately unrelated to `support_cases` and to any customer id — the support system never links a
 * request to an account (RULE-SUP-01). `reference_number` feeds the visible `REC-000001`.
 */
export const accessRecoveryRequests = pgTable(
  'access_recovery_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referenceNumber: integer('reference_number').generatedAlwaysAsIdentity(),
    contact: text('contact').notNull(),
    /** sha256 of the normalized contact: abuse limit and idempotency key without indexing the raw value. */
    contactHash: text('contact_hash').notNull(),
    description: text('description').notNull(),
    status: accessRecoveryStatusEnum('status').notNull().default('received'),
    clientRequestId: text('client_request_id'),
    handledById: text('handled_by_id'),
    handledByName: text('handled_by_name'),
    handledAt: tz('handled_at'),
    note: text('note'),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('access_recovery_reference_uq').on(t.referenceNumber),
    uniqueIndex('access_recovery_client_request_uq')
      .on(t.contactHash, t.clientRequestId)
      .where(sql`${t.clientRequestId} is not null`),
    index('access_recovery_status_idx').on(t.status, t.createdAt),
    index('access_recovery_contact_idx').on(t.contactHash, t.createdAt),
  ],
);
export type AccessRecoveryRow = typeof accessRecoveryRequests.$inferSelect;
