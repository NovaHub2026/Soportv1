import { sql } from 'drizzle-orm';
import {
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
  ATTACHMENT_STATUSES,
  CASE_CATEGORIES,
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
  },
  (t) => [
    uniqueIndex('support_cases_reference_number_uq').on(t.referenceNumber),
    index('support_cases_customer_idx').on(t.customerId, t.lastMessageAt),
    index('support_cases_queue_idx').on(t.status, t.assignedAgentId, t.createdAt),
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
    /** Client-generated id: a retried send must not duplicate the message (RULE-SUP-03). Unique per author. */
    clientMessageId: text('client_message_id'),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('case_messages_case_idx').on(t.caseId, t.createdAt),
    uniqueIndex('case_messages_author_client_message_uq')
      .on(t.authorId, t.clientMessageId)
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

export type SupportCaseRow = typeof supportCases.$inferSelect;
export type CaseAttachmentRow = typeof caseAttachments.$inferSelect;
export type CaseMessageRow = typeof caseMessages.$inferSelect;
export type CaseEventRow = typeof caseEvents.$inferSelect;
