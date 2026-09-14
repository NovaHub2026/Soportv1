import { sql } from 'drizzle-orm';
import type { CaseStatus } from '@orbit-support/shared';
import { supportCases } from '../database/schema.js';

/**
 * Case rules read by more than one service (BL-022, Cycle Audit 2 FND-0046): each has exactly one owner here,
 * so the queue, the supervision overview and the metrics can never disagree about the same case.
 */

type AwaitingFields = { status: CaseStatus; lastCustomerMessageAt: Date | null; lastStaffMessageAt: Date | null };

/** The customer's latest message when nobody from staff replied after it, on a case where a reply is due (DEC-0021). */
export function awaitingReplySince(row: AwaitingFields): Date | null {
  if (!row.lastCustomerMessageAt) return null;
  if (row.status === 'waiting_customer' || row.status === 'resolved' || row.status === 'closed') return null;
  if (row.lastStaffMessageAt && row.lastStaffMessageAt.getTime() >= row.lastCustomerMessageAt.getTime()) return null;
  return row.lastCustomerMessageAt;
}

/** SQL twin of `awaitingReplySince` for ordering; a test in `cases.service.spec.ts` keeps the two in agreement on every status. */
export const awaitingReplySinceSql = sql`case when ${supportCases.status} in ('waiting_customer', 'resolved', 'closed') then null when ${supportCases.lastStaffMessageAt} is not null and ${supportCases.lastStaffMessageAt} >= ${supportCases.lastCustomerMessageAt} then null else ${supportCases.lastCustomerMessageAt} end`;

type WaitingInternalFields = { status: CaseStatus; waitingInternalSince: Date | null; updatedAt: Date };

/**
 * Since when an internal team owes this case an answer (§5.3, §5.4): the `waiting_internal` period, or the
 * oldest open consultation when staff moved the case on while a team still has to answer (BL-029, FND-0078).
 * Null when no team owes anything.
 */
export function waitingInternalSince(row: WaitingInternalFields, oldestOpenConsultation: Date | null = null): Date | null {
  const candidates: Date[] = [];
  if (row.status === 'waiting_internal') candidates.push(row.waitingInternalSince ?? row.updatedAt);
  if (oldestOpenConsultation) candidates.push(oldestOpenConsultation);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.getTime() < a.getTime() ? b : a));
}
