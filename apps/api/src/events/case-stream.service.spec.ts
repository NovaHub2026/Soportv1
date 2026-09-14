import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CaseEventBus } from './case-event-bus.js';
import { CaseStreamService } from './case-stream.service.js';

describe('CaseStreamService per-identity cap (PH-8.1, BL-012)', () => {
  it('refuses the ninth concurrent stream of one identity with 429 and frees the slot when a stream ends', () => {
    const service = new CaseStreamService(new CaseEventBus());
    const subscriptions = Array.from({ length: 8 }, () => service.staffStream('staff-ana').subscribe());
    expect(service.openStreams('staff:staff-ana')).toBe(8);
    let refused: unknown = null;
    service.staffStream('staff-ana').subscribe({ error: (error: unknown) => (refused = error) });
    expect(refused).toBeInstanceOf(HttpException);
    expect((refused as HttpException).getStatus()).toBe(429);
    expect(service.openStreams('staff:staff-ana')).toBe(8);
    // Another identity is not affected; a released slot can be taken again.
    const other = service.customerStream('cust-alice').subscribe();
    expect(service.openStreams('customer:cust-alice')).toBe(1);
    subscriptions[0].unsubscribe();
    expect(service.openStreams('staff:staff-ana')).toBe(7);
    const again = service.staffStream('staff-ana').subscribe();
    expect(service.openStreams('staff:staff-ana')).toBe(8);
    for (const s of [...subscriptions.slice(1), other, again]) s.unsubscribe();
    expect(service.openStreams('staff:staff-ana')).toBe(0);
  });
});
