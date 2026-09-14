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
/** Who takes a recovery request over: the Verification team, which uses Orbit's KYC process (DEC-0039 i). */
export const RECOVERY_HANDLING_TEAM = "verification" as const;
export type AccessRecoveryOutcome = (typeof ACCESS_RECOVERY_OUTCOMES)[number];

/**
 * Characters refused because they can spoof what staff read (Cycle Audit 3): every control and invisible format
 * character in a contact; in free text, control characters other than tab and line breaks, and bidi controls.
 */
const CONTACT_FORBIDDEN = /[\p{Cc}\p{Cf}]/u;
const TEXT_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;
const without = (forbidden: RegExp) => <T extends z.ZodString>(schema: T) => schema.refine((value) => !forbidden.test(value), "invalid_characters");
const contactText = without(CONTACT_FORBIDDEN);
const freeText = without(TEXT_FORBIDDEN);

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_LIKE = /^\+?[\d\s().-]{8,20}$/;
/** An e-mail or a phone number — the only two ways Orbit's verification process can reach someone. */
export const looksLikeContact = (value: string): boolean => EMAIL_LIKE.test(value) || PHONE_LIKE.test(value);

/**
 * The form of a contact used for the per-contact limit and idempotency (Cycle Audit 3): compatibility-normalized,
 * lower case, invisible format characters removed; e-mails without a "+tag" and without trailing dots on the
 * domain; phones as digits only. So "Alice+x@Example.com." and "alice@example.com", or "+55 (11) 99999-1234" and
 * "5511999991234", count as one contact.
 */
export function normalizeContact(contact: string): string {
  const value = contact.normalize("NFKC").replace(/\p{Cf}/gu, "").trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at > 0) {
    const local = value.slice(0, at).split("+")[0];
    const domain = value.slice(at + 1).replace(/\.+$/, "");
    return `${local}@${domain}`;
  }
  return value.replace(/\D/g, "");
}

export const accessRecoveryInputSchema = z.object({
  contact: contactText(z.string().trim().min(5).max(120)).refine(looksLikeContact, "contact_invalid"),
  description: freeText(z.string().trim().min(10, "description_too_short").max(1000, "description_too_long")),
  /** Kept across retries so a flaky network never creates two requests (RULE-SUP-03). */
  clientRequestId: contactText(z.string().trim().min(1).max(100)).optional(),
});
export type AccessRecoveryInput = z.infer<typeof accessRecoveryInputSchema>;

/** What the person gets back: a reference and the next step — never account data. */
export interface AccessRecoveryReceipt {
  reference: string;
  receivedAt: string;
  /** The only next step today: Orbit's authorized verification process (§4.5). */
  nextStep: "orbit_verification";
  /** The team that takes the request over (DEC-0039 i, PH-10.3). */
  handlingTeam: typeof RECOVERY_HANDLING_TEAM;
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
  /** The team a forwarded request went to (DEC-0039 i); null until forwarded. */
  forwardedTo: typeof RECOVERY_HANDLING_TEAM | null;
}

export const accessRecoveryOutcomeSchema = z.object({
  outcome: z.enum(ACCESS_RECOVERY_OUTCOMES),
  note: freeText(z.string().trim().max(500)).optional(),
});
export type AccessRecoveryOutcomeInput = z.infer<typeof accessRecoveryOutcomeSchema>;

export const accessRecoveryListQuerySchema = z.object({ status: z.enum(ACCESS_RECOVERY_STATUSES).optional() });
export type AccessRecoveryListQuery = z.infer<typeof accessRecoveryListQuerySchema>;

/**
 * Working defaults against abuse of an unauthenticated route (§13.1 spirit). The instance-wide ceiling is a
 * safety net against floods; Cycle Audit 3 raised it from 30 so a handful of anonymous requests cannot close the
 * route for everyone. The per-client limit (PH-9.4, BL-026) applies where an appending reverse proxy reports the
 * client's address (`SUPPORT_TRUST_PROXY`), so one connection cannot keep the only route for people who cannot sign in busy.
 */
export const ACCESS_RECOVERY_LIMITS = { perContactPerHour: 3, perClientPer10Minutes: 10, perInstancePer10Minutes: 120 } as const;

export function formatRecoveryReference(referenceNumber: number): string {
  if (!Number.isInteger(referenceNumber) || referenceNumber < 1) throw new RangeError(`Recovery reference number must be a positive integer, got ${referenceNumber}`);
  return `REC-${String(referenceNumber).padStart(6, "0")}`;
}
