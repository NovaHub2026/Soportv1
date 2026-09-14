import { z } from "zod";

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
] as const;
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number];

export const STAFF_QUEUE_VIEWS = ["unassigned", "mine", "active"] as const;
export type StaffQueueView = (typeof STAFF_QUEUE_VIEWS)[number];
export const staffQueueViewSchema = z.enum(STAFF_QUEUE_VIEWS);

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

// ---- Request schemas ----

const messageBodySchema = z.string().trim().min(1, "message_required").max(5000, "message_too_long");
const clientMessageIdSchema = z.string().trim().min(1).max(100);

export const createCaseSchema = z.object({
  category: z.enum(CASE_CATEGORIES),
  subject: z.string().trim().min(1).max(200).optional(),
  message: messageBodySchema,
  /** Client-generated id so a retried submission does not create a second case (RULE-SUP-03). */
  clientMessageId: clientMessageIdSchema.optional(),
});
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const postMessageSchema = z.object({
  body: messageBodySchema,
  clientMessageId: clientMessageIdSchema.optional(),
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
});
export type CaseSummary = z.infer<typeof caseSummarySchema>;

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

export const customerCaseDetailSchema = caseSummarySchema.extend({
  messages: z.array(caseMessageSchema),
});
export type CustomerCaseDetail = z.infer<typeof customerCaseDetailSchema>;

export const staffCaseDetailSchema = customerCaseDetailSchema.extend({
  events: z.array(caseEventSchema),
});
export type StaffCaseDetail = z.infer<typeof staffCaseDetailSchema>;
