import type { OrbitCustomerSummary, OrbitLookup } from '@orbit-support/shared';

/**
 * The records side of the Orbit boundary (ADR-0002, PH-4): read-only lookups that answer `available` with
 * already-masked data or `unavailable` with a reason (RULE-SUP-07). Nothing here can change money, results or
 * permissions (RULE-SUP-05). A real Orbit adapter replaces the simulated one without touching callers.
 */
export interface OrbitRecordsPort {
  customerSummary(userId: string): Promise<OrbitLookup<OrbitCustomerSummary>>;
}

export const ORBIT_RECORDS = Symbol('ORBIT_RECORDS');
