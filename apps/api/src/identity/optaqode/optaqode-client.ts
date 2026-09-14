import type { OptaqodeConfig } from './optaqode-config.js';

/** The broker's error body as its frontend parses it (`error_code` or `code`, `message` string or list). */
export interface OptaqodeErrorBody {
  error_code?: string;
  code?: string;
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; signal: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export class OptaqodeHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'OptaqodeHttpError';
  }
}

export class OptaqodeTimeoutError extends Error {
  constructor(readonly path: string) {
    super(`Orbit did not answer ${path} in time`);
    this.name = 'OptaqodeTimeoutError';
  }
}

/** `error_code` wins over `code`; a list of messages (NestJS style) is joined. */
export function readErrorBody(body: unknown): { code: string | null; message: string } {
  if (!body || typeof body !== 'object') return { code: null, message: 'no error body' };
  const b = body as OptaqodeErrorBody;
  const code = typeof b.error_code === 'string' ? b.error_code : typeof b.code === 'string' ? b.code : null;
  const message = Array.isArray(b.message) ? b.message.join('; ') : typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : 'unknown error';
  return { code, message };
}

/**
 * A minimal JSON client for the broker's API: bearer token per call, the locale headers its frontend sends,
 * one timeout, the error shape parsed once. GET only — Orbit Support never writes to the broker (RULE-SUP-05).
 */
export class OptaqodeClient {
  constructor(
    private readonly config: OptaqodeConfig,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  async get<T>(path: string, options: { token: string; language?: string }): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);
    const language = options.language ?? 'pt-BR';
    try {
      const response = await this.fetchImpl(`${this.config.apiBaseUrl}${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${options.token}`,
          'x-language-code': language,
          'Accept-Language': language,
          'User-Agent': 'orbit-support/1.0',
        },
        signal: controller.signal,
      });
      if (response.status >= 200 && response.status < 300) return (await response.json()) as T;
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      const { code, message } = readErrorBody(body);
      throw new OptaqodeHttpError(response.status, code, `Orbit answered ${response.status} on ${path}: ${message}`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new OptaqodeTimeoutError(path);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
