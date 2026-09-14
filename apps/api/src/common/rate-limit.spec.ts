import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { SlidingWindowLimiter } from './rate-limit.js';

describe('SlidingWindowLimiter (PH-8.1, BL-012)', () => {
  it('allows up to max attempts per window per key, refuses the next with a retry hint, and forgets old attempts', () => {
    const limiter = new SlidingWindowLimiter(3, 60_000);
    const t0 = 1_000_000;
    expect(limiter.take('a', t0)).toEqual({ allowed: true });
    expect(limiter.take('a', t0 + 1000)).toEqual({ allowed: true });
    expect(limiter.take('a', t0 + 2000)).toEqual({ allowed: true });
    expect(limiter.take('a', t0 + 3000)).toEqual({ allowed: false, retryAfterSeconds: 57 });
    expect(limiter.take('b', t0 + 3000)).toEqual({ allowed: true }); // keys are independent
    expect(limiter.take('a', t0 + 61_000)).toEqual({ allowed: true }); // the first two attempts left the window
    expect(limiter.take('a', t0 + 61_100)).toEqual({ allowed: true });
    expect(() => limiter.assert('a', 'too_many', t0 + 61_200)).toThrow(HttpException);
    try {
      limiter.assert('a', 'too_many', t0 + 61_200);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({ error: 'too_many', retryAfterSeconds: expect.any(Number) });
    }
  });
});
