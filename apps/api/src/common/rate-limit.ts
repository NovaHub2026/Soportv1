import { HttpException } from '@nestjs/common';

/**
 * In-memory sliding-window limiter for one API instance (PH-8.1, BL-012). Working defaults protect the
 * unauthenticated and the upload surfaces from a single identity flooding them; a shared store replaces the
 * map when more than one instance runs (PH-8 topology). Never counts refused attempts.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Records one attempt for `key` and says whether it is within the window; `retryAfterSeconds` when it is not. */
  take(key: string, now = Date.now()): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const floor = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > floor);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((list[0] + this.windowMs - now) / 1000)) };
    }
    list.push(now);
    this.hits.set(key, list);
    return { allowed: true };
  }

  /** Throws 429 with a stable error code when the key exceeded its window. */
  assert(key: string, error: string, now = Date.now()): void {
    const verdict = this.take(key, now);
    if (!verdict.allowed) throw new HttpException({ error, retryAfterSeconds: verdict.retryAfterSeconds }, 429);
  }
}
