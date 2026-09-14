import { Injectable } from '@nestjs/common';
import type { CaseStreamEvent } from '@orbit-support/shared';
import { type Observable, Subject } from 'rxjs';

/**
 * In-process fan-out of case changes to open streams (ADR-0004). One API instance only: a second
 * instance would not see these events — PH-8 must introduce a shared channel before scaling out.
 */
@Injectable()
export class CaseEventBus {
  private readonly subject = new Subject<CaseStreamEvent>();

  readonly events$: Observable<CaseStreamEvent> = this.subject.asObservable();

  publish(event: CaseStreamEvent): void {
    this.subject.next(event);
  }
}
