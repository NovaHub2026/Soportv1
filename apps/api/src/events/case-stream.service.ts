import { HttpException, Injectable, type MessageEvent } from '@nestjs/common';
import { type CaseStreamEvent, type HeartbeatEvent, type StreamEvent, toCustomerCaseSummary } from '@orbit-support/shared';
import { defer, filter, finalize, interval, map, merge, type Observable } from 'rxjs';
import { positiveNumberEnv } from '../common/env.js';
import { CaseEventBus } from './case-event-bus.js';

/** Keeps idle connections alive through proxies; tests shorten it via SUPPORT_SSE_HEARTBEAT_MS. */
const heartbeatMs = () => positiveNumberEnv('SUPPORT_SSE_HEARTBEAT_MS', 15_000);

const toMessageEvent = (event: StreamEvent): MessageEvent => ({ type: event.type, data: event });

/** Open streams one identity may hold at once (PH-8.1, BL-012): tabs and reconnects, not a flood. */
const maxStreamsPerIdentity = () => positiveNumberEnv('SUPPORT_SSE_MAX_PER_IDENTITY', 8);

/** Customers never receive internal messages, and their `case.updated` carries the customer projection (FND-0006). */
const forCustomer = (event: CaseStreamEvent): CaseStreamEvent | null => {
  if (event.type === 'message.created') return event.message.visibility === 'public' ? event : null;
  return { ...event, summary: toCustomerCaseSummary(event.summary as Parameters<typeof toCustomerCaseSummary>[0]) };
};

@Injectable()
export class CaseStreamService {
  private readonly open = new Map<string, number>();

  constructor(private readonly bus: CaseEventBus) {}

  /** How many streams `key` holds right now (tests, health). */
  openStreams(key: string): number {
    return this.open.get(key) ?? 0;
  }

  /**
   * Counts the stream against its identity when it is subscribed and releases it when it completes or the client
   * disconnects; beyond the cap the request fails with 429 before any byte is streamed (BL-012).
   */
  limited(key: string, source: Observable<MessageEvent>): Observable<MessageEvent> {
    return defer(() => {
      const current = this.open.get(key) ?? 0;
      if (current >= maxStreamsPerIdentity()) throw new HttpException({ error: 'too_many_streams', max: maxStreamsPerIdentity() }, 429);
      this.open.set(key, current + 1);
      return source.pipe(
        finalize(() => {
          // The key disappears with its last stream, so one-off identities do not accumulate (Cycle Audit 3).
          const left = (this.open.get(key) ?? 1) - 1;
          if (left <= 0) this.open.delete(key);
          else this.open.set(key, left);
        }),
      );
    });
  }

  private heartbeat(): Observable<MessageEvent> {
    return interval(heartbeatMs()).pipe(
      map((): HeartbeatEvent => ({ type: 'heartbeat', at: new Date().toISOString() })),
      map(toMessageEvent),
    );
  }

  /** One customer's one case: only that case, and never an internal-visibility message (RULE-SUP-04). */
  customerCaseStream(customerId: string, caseId: string): Observable<MessageEvent> {
    const events = this.bus.events$.pipe(
      filter((event) => event.caseId === caseId && event.customerId === customerId),
      map(forCustomer),
      filter((event): event is CaseStreamEvent => event !== null),
      map(toMessageEvent),
    );
    return this.limited(`customer:${customerId}`, merge(events, this.heartbeat()));
  }

  /** All of one customer's cases (home lists, unread badges); public messages only. */
  customerStream(customerId: string): Observable<MessageEvent> {
    const events = this.bus.events$.pipe(
      filter((event) => event.customerId === customerId),
      map(forCustomer),
      filter((event): event is CaseStreamEvent => event !== null),
      map(toMessageEvent),
    );
    return this.limited(`customer:${customerId}`, merge(events, this.heartbeat()));
  }

  /** Staff see every case change, including internal notes. */
  staffStream(staffId: string): Observable<MessageEvent> {
    return this.limited(`staff:${staffId}`, merge(this.bus.events$.pipe(map(toMessageEvent)), this.heartbeat()));
  }
}
