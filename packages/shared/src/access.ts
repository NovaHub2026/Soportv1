import { z } from "zod";

/**
 * Access recovery (PH-7.1, context §4.5, §14 item 8): a person who cannot sign in leaves an UNVERIFIED contact
 * and a description and receives a reference. Nothing here identifies an account: the support system records
 * and hands the request to Orbit's verification process (simulated and labeled until BL-002 is resolved).
 * Knowing an e-mail, an id or a reference reveals nothing (RULE-SUP-01).
 */
export const ACCESS_RECOVERY_STATUSES = ["received", "forwarded", "closed"] as const;
export type AccessRecoveryStatus = (typeof ACCESS_RECOVERY_STATUSES)[number];
export const ACCESS_RECOVERY_OUTCOMES = ["forwarded", "closed"] as const;
export type AccessRecoveryOutcome = (typeof ACCESS_RECOVERY_OUTCOMES)[number];

const noNul = <T extends z.ZodString>(schema: T) => schema.refine((value) => !value.includes("\u0000"), "invalid_characters");
const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_LIKE = /^\+?[\d\s().-]{8,20}$/;
/** An e-mail or a phone number — the only two ways Orbit's verification process can reach someone. */
export const looksLikeContact = (value: string): boolean => EMAIL_LIKE.test(value) || PHONE_LIKE.test(value);

export const accessRecoveryInputSchema = z.object({
  contact: noNul(z.string().trim().min(5).max(120)).refine(looksLikeContact, "contact_invalid"),
  description: noNul(z.string().trim().min(10, "description_too_short").max(1000, "description_too_long")),
  /** Kept across retries so a flaky network never creates two requests (RULE-SUP-03). */
  clientRequestId: noNul(z.string().trim().min(1).max(100)).optional(),
});
export type AccessRecoveryInput = z.infer<typeof accessRecoveryInputSchema>;

/** What the person gets back: a reference and the next step — never account data. */
export interface AccessRecoveryReceipt {
  reference: string;
  receivedAt: string;
  /** The only next step today: Orbit's authorized verification process (§4.5). */
  nextStep: "orbit_verification";
  /** The hand-off is simulated until a real process exists (DEC-0003). */
  delivery: "simulated";
}

/** Staff view of a request. The contact is shown to staff because they must reach the person; it is never joined to any account. */
export interface AccessRecoveryRequest {
  id: string;
  reference: string;
  contact: string;
  description: string;
  status: AccessRecoveryStatus;
  createdAt: string;
  handledById: string | null;
  handledByName: string | null;
  handledAt: string | null;
  note: string | null;
}

export const accessRecoveryOutcomeSchema = z.object({
  outcome: z.enum(ACCESS_RECOVERY_OUTCOMES),
  note: noNul(z.string().trim().max(500)).optional(),
});
export type AccessRecoveryOutcomeInput = z.infer<typeof accessRecoveryOutcomeSchema>;

export const accessRecoveryListQuerySchema = z.object({ status: z.enum(ACCESS_RECOVERY_STATUSES).optional() });
export type AccessRecoveryListQuery = z.infer<typeof accessRecoveryListQuerySchema>;

/** Working defaults against abuse of an unauthenticated route (§13.1 spirit). */
export const ACCESS_RECOVERY_LIMITS = { perContactPerHour: 3, perInstancePer10Minutes: 30 } as const;

export function formatRecoveryReference(referenceNumber: number): string {
  if (!Number.isInteger(referenceNumber) || referenceNumber < 1) throw new RangeError(`Recovery reference number must be a positive integer, got ${referenceNumber}`);
  return `REC-${String(referenceNumber).padStart(6, "0")}`;
}
