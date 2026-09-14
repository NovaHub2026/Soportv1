import type { OrbitCustomerSummary, OrbitLookup, OrbitRecord, OrbitRecordKind } from '@orbit-support/shared';

/**
 * The records side of the Orbit boundary (ADR-0002, PH-4): read-only lookups that answer `available` with
 * already-masked data or `unavailable` with a reason (RULE-SUP-07). Nothing here can change money, results or
 * permissions (RULE-SUP-05). A real Orbit adapter replaces the simulated one without touching callers.
 */
export interface OrbitRecordsPort {
  customerSummary(userId: string): Promise<OrbitLookup<OrbitCustomerSummary>>;
  /** The customer's own records relevant to support (§6.1 subjects served today), newest first. */
  listRecords(userId: string): Promise<OrbitLookup<OrbitRecord[]>>;
  /** One record, only if it belongs to the customer — anything else is `not_found` (RULE-SUP-01). */
  getRecord(userId: string, kind: OrbitRecordKind, reference: string): Promise<OrbitLookup<OrbitRecord>>;
  /**
   * The customer's verified e-mail address for outbound notifications only — never returned to a UI (§10.2).
   * `available` with `data: null` means "no address"; `unavailable` means "could not ask" and must not be
   * treated as an answer (RULE-SUP-07, FND-0032).
   */
  contactEmail(userId: string): Promise<OrbitLookup<string | null>>;
}

export const ORBIT_RECORDS = Symbol('ORBIT_RECORDS');
