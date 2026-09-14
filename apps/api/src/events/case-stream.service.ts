import { Injectable, type MessageEvent } from '@nestjs/common';
import type { HeartbeatEvent, StreamEvent } from '@orbit-support/shared';
import { filter, interval, map, merge, type Observable } from 'rxjs';
import { CaseEventBus } from './case-event-bus.js';

/** Keeps idle connections alive through proxies; tests shorten it via SUPPORT_SSE_HEARTBEAT_MS. */
const heartbeatMs = () => Number(process.env.SUPPORT_SSE_HEARTBEAT_MS ?? 15_000);

const toMessageEvent = (event: StreamEvent): MessageEvent => ({ type: event.type, data: event });

@Injectable()
export class CaseStreamService {
  constructor(private readonly bus: CaseEventBus) {}

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
      filter((event) => event.type !== 'message.created' || event.message.visibility === 'public'),
      map(toMessageEvent),
    );
    return merge(events, this.heartbeat());
  }

  /** All of one customer's cases (home lists, unread badges); public messages only. */
  customerStream(customerId: string): Observable<MessageEvent> {
    const events = this.bus.events$.pipe(
      filter((event) => event.customerId === customerId),
      filter((event) => event.type !== 'message.created' || event.message.visibility === 'public'),
      map(toMessageEvent),
    );
    return merge(events, this.heartbeat());
  }

  /** Staff see every case change, including internal notes. */
  staffStream(): Observable<MessageEvent> {
    return merge(this.bus.events$.pipe(map(toMessageEvent)), this.heartbeat());
  }
}
