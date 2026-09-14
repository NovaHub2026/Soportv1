import { describe, expect, it } from 'vitest';
import { awaitingReplySince, waitingInternalSince } from './case-rules.js';

const t = (hoursAgo: number) => new Date(Date.UTC(2026, 8, 14, 12) - hoursAgo * 3_600_000);

describe('case rules (BL-022, BL-029)', () => {
  it('awaitingReplySince: the customer waits only when their latest message is newer than staff\'s and a reply is due', () => {
    expect(awaitingReplySince({ status: 'new', lastCustomerMessageAt: t(2), lastStaffMessageAt: null })).toEqual(t(2));
    expect(awaitingReplySince({ status: 'in_progress', lastCustomerMessageAt: t(2), lastStaffMessageAt: t(1) })).toBeNull();
    expect(awaitingReplySince({ status: 'in_progress', lastCustomerMessageAt: t(1), lastStaffMessageAt: t(1) })).toBeNull();
    expect(awaitingReplySince({ status: 'waiting_internal', lastCustomerMessageAt: t(1), lastStaffMessageAt: t(2) })).toEqual(t(1));
    for (const status of ['waiting_customer', 'resolved', 'closed'] as const) {
      expect(awaitingReplySince({ status, lastCustomerMessageAt: t(1), lastStaffMessageAt: null })).toBeNull();
    }
    expect(awaitingReplySince({ status: 'new', lastCustomerMessageAt: null, lastStaffMessageAt: null })).toBeNull();
  });

  it('waitingInternalSince: the waiting_internal period, or the oldest open consultation whatever the status, the older of the two', () => {
    const base = { waitingInternalSince: t(3), updatedAt: t(1) };
    expect(waitingInternalSince({ status: 'waiting_internal', ...base })).toEqual(t(3));
    expect(waitingInternalSince({ status: 'waiting_internal', waitingInternalSince: null, updatedAt: t(1) })).toEqual(t(1)); // rows older than migration 0017
    expect(waitingInternalSince({ status: 'in_progress', ...base })).toBeNull();
    expect(waitingInternalSince({ status: 'in_progress', ...base }, t(5))).toEqual(t(5)); // FND-0078: moved on, the team still owes an answer
    expect(waitingInternalSince({ status: 'waiting_customer', ...base }, t(2))).toEqual(t(2));
    expect(waitingInternalSince({ status: 'waiting_internal', ...base }, t(2))).toEqual(t(3));
    expect(waitingInternalSince({ status: 'waiting_internal', ...base }, t(9))).toEqual(t(9));
  });
});
