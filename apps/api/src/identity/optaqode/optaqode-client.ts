import type { OptaqodeConfig } from './optaqode-config.js';

/** The broker's error body as its frontend parses it (`error_code` or `code`, `message` string or list). */
export interface OptaqodeErrorBody {
  error_code?: string;
  code?: string;
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown>; text(): Promise<string> }>;

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
 * one timeout, the error shape parsed once. Reads are GET; the only POSTs are the service account's own
 * login and refresh — Orbit Support never writes business data to the broker (RULE-SUP-05).
 */
export class OptaqodeClient {
  constructor(
    private readonly config: OptaqodeConfig,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  get<T>(path: string, options: { token: string; language?: string }): Promise<T> {
    return this.call<T>('GET', path, options);
  }

  /** Auth calls only (`/admin/auth/login`, `/auth/refresh`). */
  post<T>(path: string, body: unknown, options: { token?: string; language?: string } = {}): Promise<T> {
    return this.call<T>('POST', path, { ...options, body });
  }

  private async call<T>(method: 'GET' | 'POST', path: string, options: { token?: string; language?: string; body?: unknown }): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);
    const language = options.language ?? 'pt-BR';
    try {
      const response = await this.fetchImpl(`${this.config.apiBaseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          'x-language-code': language,
          'Accept-Language': language,
          'User-Agent': 'orbit-support/1.0',
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
