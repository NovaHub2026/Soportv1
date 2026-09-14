import type { IdentitySource } from "./identity.js";

/**
 * Orbit records vocabulary (PROJECT_CONTEXT.md §6). Everything here crosses the Orbit boundary (ADR-0002)
 * already masked: contact and destination details are masked by default (§10.2), and a lookup is either
 * available or explicitly unavailable with a reason — never an assumed value (RULE-SUP-07).
 */
export const ORBIT_ACCOUNT_STATUSES = ["active", "restricted", "blocked", "closed"] as const;
export type OrbitAccountStatus = (typeof ORBIT_ACCOUNT_STATUSES)[number];

export const ORBIT_VERIFICATION_STATUSES = ["verified", "pending", "unverified", "rejected"] as const;
export type OrbitVerificationStatus = (typeof ORBIT_VERIFICATION_STATUSES)[number];

export const ORBIT_ENVIRONMENTS = ["real", "demo"] as const;
export type OrbitEnvironment = (typeof ORBIT_ENVIRONMENTS)[number];

/** Why a lookup has no data. `not_integrated` is the honest answer for subjects the boundary does not serve yet. */
export const ORBIT_UNAVAILABLE_REASONS = ["not_integrated", "not_found", "unavailable", "timeout"] as const;
export type OrbitUnavailableReason = (typeof ORBIT_UNAVAILABLE_REASONS)[number];

/** The standard customer summary (§6.1). Contact fields arrive masked from the adapter. */
export interface OrbitCustomerSummary {
  userId: string;
  username: string;
  accountStatus: OrbitAccountStatus;
  language: string;
  country: string;
  registeredAt: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  verificationStatus: OrbitVerificationStatus;
  /** What the customer should do next when verification is not complete; null when nothing is pending. */
  verificationNextAction: string | null;
  environment: OrbitEnvironment;
}

export interface OrbitLookupMeta {
  /** Which adapter answered; `simulated` must be labeled as such in every UI (DEC-0003). */
  source: IdentitySource;
  fetchedAt: string;
}

export type OrbitLookup<T> =
  | (OrbitLookupMeta & { state: "available"; data: T })
  | (OrbitLookupMeta & { state: "unavailable"; reason: OrbitUnavailableReason });

/** Record subjects served today (§6.1 rows the initial categories route). Others answer `not_integrated`. */
export const ORBIT_RECORD_KINDS = ["operation", "pix_deposit", "withdrawal"] as const;
export type OrbitRecordKind = (typeof ORBIT_RECORD_KINDS)[number];

/** One line of context about a record, already masked by the adapter (destinations, references). */
export interface OrbitRecordFact {
  label: string;
  value: string;
}

/**
 * A record as the boundary presents it: enough for a customer to recognize it and for staff to investigate
 * (§6.1), without prescribing Orbit's schema — the facts list is what the real adapter maps per subject.
 */
export interface OrbitRecord {
  kind: OrbitRecordKind;
  reference: string;
  title: string;
  status: string;
  occurredAt: string;
  amount: string | null;
  currency: string | null;
  facts: OrbitRecordFact[];
}

/** A record in the customer's own list, with the active case already attached to it, if any (§4.2). */
export interface OrbitRecordListItem extends OrbitRecord {
  activeCaseId: string | null;
  activeCaseReference: string | null;
}

/** What staff get for a case: the customer's summary and, when the case is about a record, its current state. */
export interface OrbitCaseContext {
  customer: OrbitLookup<OrbitCustomerSummary>;
  /** Current lookup of the linked record (the case keeps the snapshot captured when it was opened — §6.2). */
  record: OrbitLookup<OrbitRecord> | null;
}

/** `alice.souza@example.com` → `a***@e***.com`: recognizable, not reusable. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local[0]}***@${host[0] ?? ""}***${tld}`;
}

/** Keeps the country code and the last four digits: `+55 11 99999-1234` → `+55 ••• ••• 1234`. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  const last = digits.slice(-4);
  const code = phone.trim().match(/^\+(\d{1,3})/);
  const country = code ? `+${code[1]} ` : "";
  return `${country}••• ••• ${last}`;
}
