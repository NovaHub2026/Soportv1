import { type ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';

/** Seconds to wait when a refusal carries no hint of its own (the stream cap frees a slot as soon as a stream closes). */
export const DEFAULT_RETRY_AFTER_SECONDS = 5;

/**
 * Every 429 says when to try again (BL-026, cycle 3 FND-0070): the `Retry-After` header carries the body's
 * `retryAfterSeconds`, or a short default when the refusal has none. Every other exception keeps Nest's handling.
 */
@Catch(HttpException)
export class RetryAfterFilter extends BaseExceptionFilter {
  override catch(exception: HttpException, host: ArgumentsHost): void {
    if (exception.getStatus() === 429 && host.getType() === 'http') {
      const body = exception.getResponse() as { retryAfterSeconds?: unknown } | string;
      const hint = typeof body === 'object' && typeof body.retryAfterSeconds === 'number' ? body.retryAfterSeconds : DEFAULT_RETRY_AFTER_SECONDS;
      const response = host.switchToHttp().getResponse<Response>();
      if (!response.headersSent) response.setHeader('Retry-After', String(Math.max(1, Math.ceil(hint))));
    }
    super.catch(exception, host);
  }
}
