import { z } from "zod";
import { ORBIT_RECORD_KINDS, ORBIT_UNAVAILABLE_REASONS, type OrbitRecord } from "./orbit.js";

// ---- Vocabulary (PROJECT_CONTEXT.md §4.1 topics, §7 lifecycle, §5.4 priority) ----

export const CASE_STATUSES = [
  "new",
  "in_progress",
  "waiting_customer",
  "waiting_internal",
  "resolved",
  "closed",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** Statuses in which a case still needs work from someone (RULE-SUP-02). */
export const OPEN_CASE_STATUSES: readonly CaseStatus[] = [
  "new",
  "in_progress",
  "waiting_customer",
  "waiting_internal",
];

export const CASE_CATEGORIES = [
  "deposits_withdrawals",
  "operations",
  "account_verification",
  "bonuses_promotions",
  "other",
] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const CASE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const MESSAGE_AUTHOR_TYPES = ["customer", "staff", "system"] as const;
export type MessageAuthorType = (typeof MESSAGE_AUTHOR_TYPES)[number];

/** `internal` messages are staff notes and must never reach a customer surface (RULE-SUP-04). */
export const MESSAGE_VISIBILITIES = ["public", "internal"] as const;
export type MessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export const CASE_EVENT_TYPES = [
  "case_created",
  "case_assigned",
  "status_changed",
  "case_reopened",
  // PH-3 vocabulary (added to the database enum in migration 0003)
  "case_resolved",
  "case_closed",
  "priority_changed",
  "category_changed",
  "consultation_requested",
  "consultation_answered",
  "follow_up_created",
  "incident_linked",
] as const;
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number];

/** Statuses staff may set directly (§7); `resolved` goes through the resolution flow, `closed` through closure. */
export const STAFF_STATUS_TARGETS = ["in_progress", "waiting_customer", "waiting_internal"] as const;
export type StaffStatusTarget = (typeof STAFF_STATUS_TARGETS)[number];

/** Working defaults for resolution reasons (context §7.1, §13.1) — refine with Operations (BL-002). */
export const RESOLUTION_REASONS = [
  "solved",
  "answered",
  "no_action_possible",
  "handled_elsewhere",
  "duplicate",
  "no_customer_response",
] as const;
export type ResolutionReason = (typeof RESOLUTION_REASONS)[number];

// ---- Internal collaboration (PH-3.2, context §5.3) ----

/** Teams a case can be referred to. Fixed list until Orbit's organisation exists (BL-002). */
export const CONSULTATION_TEAMS = ["finance", "operations", "security", "verification", "product"] as const;
export type ConsultationTeam = (typeof CONSULTATION_TEAMS)[number];

export const CONSULTATION_STATUSES = ["open", "answered"] as const;
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

/**
 * Free text fields refuse NUL bytes: PostgreSQL cannot store them and the API used to answer 500
 * (Cycle Audit 1, FND-0016). Other control characters are stored verbatim.
 */
const text = <T extends z.ZodString>(schema: T) => schema.refine((value) => !value.includes("\u0000"), "invalid_characters");

export const caseConsultationSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  team: z.enum(CONSULTATION_TEAMS),
  question: z.string(),
  status: z.enum(CONSULTATION_STATUSES),
  requestedById: z.string(),
  requestedByName: z.string().nullable(),
  requestedAt: z.string(),
  answeredById: z.string().nullable(),
  answeredByName: z.string().nullable(),
  answeredAt: z.string().nullable(),
  answer: z.string().nullable(),
});
export type CaseConsultation = z.infer<typeof caseConsultationSchema>;

/** Internal notes are messages with `internal` visibility; they never reach customer surfaces (RULE-SUP-04). */
export const postNoteSchema = z.object({
  body: text(z.string().trim().min(1, "note_required").max(5000, "note_too_long")),
});
export type PostNoteInput = z.infer<typeof postNoteSchema>;

export const requestConsultationSchema = z.object({
  team: z.enum(CONSULTATION_TEAMS),
  question: text(z.string().trim().min(1, "question_required").max(5000, "question_too_long")),
});
export type RequestConsultationInput = z.infer<typeof requestConsultationSchema>;

export const answerConsultationSchema = z.object({
  answer: text(z.string().trim().min(1, "answer_required").max(5000, "answer_too_long")),
});
export type AnswerConsultationInput = z.infer<typeof answerConsultationSchema>;

// ---- Shared incidents (PH-3.5, context §5.4) ----

export const INCIDENT_STATUSES = ["open", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const incidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(INCIDENT_STATUSES),
  createdById: z.string(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  resolvedById: z.string().nullable(),
  /** Cases currently linked (all statuses). */
  linkedCaseCount: z.number().int().nonnegative(),
});
export type Incident = z.infer<typeof incidentSchema>;

export const createIncidentSchema = z.object({
  title: text(z.string().trim().min(3, "title_too_short").max(200, "title_too_long")),
  description: text(z.string().trim().max(5000)).optional(),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

/** `incidentId: null` unlinks the case. */
export const linkIncidentSchema = z.object({
  incidentId: z.uuid().nullable(),
});
export type LinkIncidentInput = z.infer<typeof linkIncidentSchema>;

export const incidentNoteSchema = z.object({
  body: text(z.string().trim().min(1, "note_required").max(5000, "note_too_long")),
});
export type IncidentNoteInput = z.infer<typeof incidentNoteSchema>;

// ---- Closure and follow-up (PH-3.4, context §7.3) ----

export const CLOSED_REASONS = ["auto_window", "staff"] as const;
export type ClosedReason = (typeof CLOSED_REASONS)[number];

/** "Preciso de mais ajuda" from a closed case: a new linked case with the customer's first message. */
export const followUpSchema = z.object({
  message: text(z.string().trim().min(1, "message_required").max(5000, "message_too_long")),
  clientMessageId: text(z.string().trim().min(1).max(100)).optional(),
});
export type FollowUpInput = z.infer<typeof followUpSchema>;

// ---- Assignment and attributes (PH-3.3, context §5.2, §5.4) ----

/** `agentId: null` releases the case back to the unassigned queue. */
export const assignCaseSchema = z.object({
  agentId: text(z.string().trim().min(1).max(64)).nullable(),
});
export type AssignCaseInput = z.infer<typeof assignCaseSchema>;

export const updateCaseSchema = z
  .object({
    priority: z.enum(CASE_PRIORITIES).optional(),
    category: z.enum(CASE_CATEGORIES).optional(),
  })
  .refine((value) => value.priority !== undefined || value.category !== undefined, { message: "nothing_to_update" });
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

export const setStatusSchema = z.object({
  status: z.enum(STAFF_STATUS_TARGETS),
});
export type SetStatusInput = z.infer<typeof setStatusSchema>;

export const resolveCaseSchema = z.object({
  reason: z.enum(RESOLUTION_REASONS),
  /** Customer-facing explanation; posted as a public message so it lives in the conversation (§7.1). */
  explanation: text(z.string().trim().min(1, "explanation_required").max(5000, "explanation_too_long")),
});
export type ResolveCaseInput = z.infer<typeof resolveCaseSchema>;

/** Every lifecycle state is reachable (context §5.2, PH-5.1): open views plus waiting, resolved and closed history. */
export const STAFF_QUEUE_VIEWS = ["unassigned", "mine", "active", "waiting_customer", "waiting_internal", "resolved", "closed"] as const;
export type StaffQueueView = (typeof STAFF_QUEUE_VIEWS)[number];
export const staffQueueViewSchema = z.enum(STAFF_QUEUE_VIEWS);

/** Pagination of staff lists (offset-based; PH-5.1). */
export const STAFF_LIST_LIMITS = { default: 50, max: 200 } as const;
export const staffListQuerySchema = z.object({
  view: staffQueueViewSchema.default("unassigned"),
  limit: z.coerce.number().int().min(1).max(STAFF_LIST_LIMITS.max).default(STAFF_LIST_LIMITS.default),
  offset: z.coerce.number().int().min(0).default(0),
  /** Search (PH-5.2, §5.2): a case reference (with or without `SUP-`), a customer id, subject words or a record reference. */
  q: text(z.string().trim().min(1).max(100)).optional(),
  category: z.enum(CASE_CATEGORIES).optional(),
  priority: z.enum(CASE_PRIORITIES).optional(),
  /** A staff id, or `unassigned`. */
  agentId: text(z.string().trim().min(1).max(64)).optional(),
});
export type StaffListQuery = z.infer<typeof staffListQuerySchema>;

// ---- Customer notifications (PH-6.1, context §4.4) ----

export const NOTIFICATION_KINDS = ["staff_reply", "waiting_customer", "resolved", "closed", "reminder", "outside_hours"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Never carries message content: the kind and the case reference are enough to bring the customer back. */
export interface CustomerNotification {
  id: string;
  caseId: string;
  caseReference: string;
  kind: NotificationKind;
  createdAt: string;
  readAt: string | null;
}

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.uuid()).max(100).optional(),
  caseId: z.uuid().optional(),
});
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

// ---- Saved replies (PH-5.3, context §5.2 / §5.4) ----

export const savedReplyInputSchema = z.object({
  title: text(z.string().trim().min(1, "title_required").max(120, "title_too_long")),
  body: text(z.string().trim().min(1, "body_required").max(5000, "body_too_long")),
  category: z.enum(CASE_CATEGORIES).optional(),
});
export type SavedReplyInput = z.infer<typeof savedReplyInputSchema>;

export interface SavedReply {
  id: string;
  title: string;
  body: string;
  category: CaseCategory | null;
  createdById: string;
  createdByName: string | null;
  updatedById: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Case reference (PROJECT_CONTEXT.md §6.1: identifies a matter, is not a credential) ----

export const CASE_REFERENCE_PREFIX = "SUP";
const CASE_REFERENCE_DIGITS = 6;
export const caseReferencePattern = new RegExp(`^${CASE_REFERENCE_PREFIX}-\\d{${CASE_REFERENCE_DIGITS},}$`);

/** `1` → `SUP-000001`; numbers beyond six digits keep all their digits. */
export function formatCaseReference(referenceNumber: number): string {
  if (!Number.isInteger(referenceNumber) || referenceNumber < 1) {
    throw new RangeError(`Case reference number must be a positive integer, got ${referenceNumber}`);
  }
  return `${CASE_REFERENCE_PREFIX}-${String(referenceNumber).padStart(CASE_REFERENCE_DIGITS, "0")}`;
}

/** Derives a short subject from the first message when the customer did not type one (§4.1: no long form). */
export function deriveSubject(message: string, maxLength = 80): string {
  const firstLine = message.trim().split(/\r?\n/, 1)[0] ?? "";
  const collapsed = firstLine.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`;
}

// ---- Attachments (PROJECT_CONTEXT.md §10.2, §13.1 working defaults) ----

export const ATTACHMENT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxPerMessage: 3,
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
} as const;
export type AllowedAttachmentMimeType = (typeof ATTACHMENT_LIMITS.allowedMimeTypes)[number];

/** `checking` is reserved for asynchronous scanning; today checks are synchronous and uploads land `available`. */
export const ATTACHMENT_STATUSES = ["checking", "available", "rejected"] as const;
export type AttachmentStatus = (typeof ATTACHMENT_STATUSES)[number];

export const caseAttachmentSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  messageId: z.string().nullable(),
  uploaderType: z.enum(MESSAGE_AUTHOR_TYPES),
  uploaderId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  status: z.enum(ATTACHMENT_STATUSES),
  createdAt: z.string(),
});
export type CaseAttachment = z.infer<typeof caseAttachmentSchema>;

// ---- Request schemas ----

const messageBodySchema = text(z.string().trim().min(1, "message_required").max(5000, "message_too_long"));
/** Client-generated idempotency key: unique per case and author for messages, per customer for case creation. */
const clientMessageIdSchema = text(z.string().trim().min(1).max(100));
const attachmentIdsSchema = z.array(z.uuid()).max(ATTACHMENT_LIMITS.maxPerMessage, "too_many_attachments");

/** The record a request is about (§4.2): kind + reference; ownership and the snapshot are resolved server-side. */
export const caseRecordRefSchema = z.object({
  kind: z.enum(ORBIT_RECORD_KINDS),
  reference: text(z.string().trim().min(1).max(100)),
});
export type CaseRecordRef = z.infer<typeof caseRecordRefSchema>;

export const createCaseSchema = z.object({
  category: z.enum(CASE_CATEGORIES),
  subject: text(z.string().trim().min(1).max(200)).optional(),
  message: messageBodySchema,
  /** Contextual entry from a record ("Preciso de ajuda" on a withdrawal, a deposit, an operation). */
  record: caseRecordRefSchema.optional(),
  /** Client-generated id so a retried submission does not create a second case (RULE-SUP-03). */
  clientMessageId: clientMessageIdSchema.optional(),
});
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const postMessageSchema = z.object({
  body: messageBodySchema,
  clientMessageId: clientMessageIdSchema.optional(),
  /** Attachments uploaded beforehand by the same author and not yet linked to a message. */
  attachmentIds: attachmentIdsSchema.optional(),
});
export type PostMessageInput = z.infer<typeof postMessageSchema>;

// ---- Response shapes ----

export const caseMessageSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  authorType: z.enum(MESSAGE_AUTHOR_TYPES),
  authorId: z.string(),
  authorName: z.string().nullable(),
  visibility: z.enum(MESSAGE_VISIBILITIES),
  body: z.string(),
  clientMessageId: z.string().nullable(),
  createdAt: z.string(),
  attachments: z.array(caseAttachmentSchema),
});
export type CaseMessage = z.infer<typeof caseMessageSchema>;

export const caseSummarySchema = z.object({
  id: z.string(),
  reference: z.string(),
  customerId: z.string(),
  subject: z.string(),
  category: z.enum(CASE_CATEGORIES),
  status: z.enum(CASE_STATUSES),
  priority: z.enum(CASE_PRIORITIES),
  assignedAgentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastMessageAt: z.string(),
  lastCustomerMessageAt: z.string().nullable(),
  lastStaffMessageAt: z.string().nullable(),
  /** When the customer last opened the conversation; lets staff see whether a reply was read (§4.3). */
  customerLastReadAt: z.string().nullable(),
  /** When staff last opened the conversation. */
  staffLastReadAt: z.string().nullable(),
  /** Messages the *viewer* has not read yet — viewer-dependent, recomputed per request; 0 inside stream events. */
  unreadCount: z.number().int().nonnegative(),
  resolvedAt: z.string().nullable(),
  resolutionReason: z.enum(RESOLUTION_REASONS).nullable(),
  closedAt: z.string().nullable(),
  /** The case this one continues (set on a follow-up opened from a closed case — §7.3). */
  parentCaseId: z.string().nullable(),
  parentReference: z.string().nullable(),
  /** Shared incident this case is associated with, if any (§5.4). Staff-only: stripped from customer surfaces. */
  incidentId: z.string().nullable(),
  incidentTitle: z.string().nullable(),
  /** The record this case is about, if it was opened from one (§4.2). The snapshot travels in the detail. */
  recordKind: z.enum(ORBIT_RECORD_KINDS).nullable(),
  recordReference: z.string().nullable(),
  /**
   * Since when the customer waits for a human reply: the latest customer message when it is newer than the
   * latest staff reply and the case is neither waiting for the customer nor final (PH-5.1, §14 item 9). Staff-only.
   */
  awaitingReplySince: z.string().nullable(),
});
export type CaseSummary = z.infer<typeof caseSummarySchema>;

/**
 * The record card attached to a case: what the record looked like when the case was opened (§6.2 — the
 * conditions at the time, distinct from the current status staff read live). `snapshot` is null when the
 * adapter could not answer at that moment; `lookupReason` says why, so the case proceeds as an investigation,
 * never with an assumed answer (RULE-SUP-07, §14 item 7).
 */
export interface CaseRecord {
  kind: (typeof ORBIT_RECORD_KINDS)[number];
  reference: string;
  capturedAt: string;
  snapshot: OrbitRecord | null;
  lookupReason: (typeof ORBIT_UNAVAILABLE_REASONS)[number] | null;
}

/**
 * Fields that describe how staff work the case, never the customer's own matter. They are removed from every
 * customer response and customer stream event (RULE-SUP-04, context §10.2 — Cycle Audit 1, FND-0006).
 */
export const STAFF_ONLY_SUMMARY_FIELDS = ["priority", "assignedAgentId", "staffLastReadAt", "incidentId", "incidentTitle", "awaitingReplySince"] as const;
export type StaffOnlySummaryField = (typeof STAFF_ONLY_SUMMARY_FIELDS)[number];

export const customerCaseSummarySchema = caseSummarySchema.omit({
  priority: true,
  assignedAgentId: true,
  staffLastReadAt: true,
  incidentId: true,
  incidentTitle: true,
  awaitingReplySince: true,
});
export type CustomerCaseSummary = z.infer<typeof customerCaseSummarySchema>;

/** The customer projection of a summary: the same object minus every staff-only field. */
export function toCustomerCaseSummary(summary: CaseSummary): CustomerCaseSummary {
  const copy: Record<string, unknown> = { ...summary };
  for (const field of STAFF_ONLY_SUMMARY_FIELDS) delete copy[field];
  return copy as CustomerCaseSummary;
}

export const caseEventSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  type: z.enum(CASE_EVENT_TYPES),
  actorType: z.enum(MESSAGE_AUTHOR_TYPES),
  actorId: z.string(),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export type CaseEvent = z.infer<typeof caseEventSchema>;

export const customerCaseDetailSchema = customerCaseSummarySchema.extend({
  messages: z.array(caseMessageSchema),
});
export type CustomerCaseDetail = z.infer<typeof customerCaseDetailSchema> & { record: CaseRecord | null };

export const staffCaseDetailSchema = caseSummarySchema.extend({
  messages: z.array(caseMessageSchema),
  events: z.array(caseEventSchema),
  consultations: z.array(caseConsultationSchema),
});
export type StaffCaseDetail = z.infer<typeof staffCaseDetailSchema> & { record: CaseRecord | null };
