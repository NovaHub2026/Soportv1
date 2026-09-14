import { Logger } from '@nestjs/common';
import { OptaqodeClient, OptaqodeHttpError } from './optaqode-client.js';
import { type OptaqodeConfig, OPTAQODE_ENV } from './optaqode-config.js';
import { decodeJwtPayload } from './optaqode-jwt.js';

/** Where the bearer for the admin read endpoints comes from. */
export interface TokenSource {
  token(): Promise<string>;
  /** The broker refused the last token (401): forget it so the next call obtains a fresh one. */
  invalidate(): void;
}

export class StaticToken implements TokenSource {
  constructor(private readonly value: string) {}
  async token(): Promise<string> {
    return this.value;
  }
  invalidate(): void {}
}

/** `POST /admin/auth/login` / `POST /auth/refresh` as the broker's frontend normalizes them (camel or snake case). */
interface LoginResponse {
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  expiresIn?: number;
  expires_in?: number;
  challengeRequired?: boolean;
  challenge_required?: boolean;
  challengeMethod?: string;
  challenge_method?: string;
}

export class OptaqodeServiceAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptaqodeServiceAccountError';
  }
}

const REFRESH_MARGIN_S = 60;

/**
 * The support service account's session in the broker's back-office (DEC-0046 b): a team member the Owner creates
 * for Orbit Support (read-only role); this class logs in with its e-mail and password, keeps the access token,
 * refreshes it through the shared `POST /auth/refresh` before it expires (or after a 401), and never stores the
 * password anywhere but memory. A two-factor challenge is a configuration error, not something to answer.
 */
export class OptaqodeServiceSession implements TokenSource {
  private readonly logger = new Logger(OptaqodeServiceSession.name);
  private access: { token: string; expiresAt: number } | null = null;
  private refresh: string | null = null;
  private pending: Promise<string> | null = null;

  constructor(
    private readonly config: OptaqodeConfig,
    private readonly client: OptaqodeClient = new OptaqodeClient(config),
    private readonly now: () => number = () => Date.now(),
  ) {
    if (!config.serviceEmail || !config.servicePassword) {
      throw new OptaqodeServiceAccountError(`${OPTAQODE_ENV.serviceEmail} and ${OPTAQODE_ENV.servicePassword} are required for the service session`);
    }
  }

  async token(): Promise<string> {
    if (this.access && this.access.expiresAt - REFRESH_MARGIN_S * 1000 > this.now()) return this.access.token;
    if (!this.pending) this.pending = this.obtain().finally(() => (this.pending = null));
    return this.pending;
  }

  invalidate(): void {
    this.access = null;
  }

  private async obtain(): Promise<string> {
    if (this.refresh) {
      try {
        return this.accept(await this.client.post<LoginResponse>('/auth/refresh', { refreshToken: this.refresh }), 'refresh');
      } catch (error) {
        // A refresh the broker no longer accepts falls back to a login; anything else (timeout, 5xx) is the caller's.
        if (!(error instanceof OptaqodeHttpError && (error.status === 401 || error.status === 403))) throw error;
        this.logger.warn('Orbit refused the service refresh token; logging in again');
        this.refresh = null;
      }
    }
    return this.accept(await this.client.post<LoginResponse>('/admin/auth/login', { email: this.config.serviceEmail, password: this.config.servicePassword }), 'login');
  }

  private accept(response: LoginResponse, step: 'login' | 'refresh'): string {
    if (response.challengeRequired || response.challenge_required) {
      throw new OptaqodeServiceAccountError(`The support service account answered a two-factor challenge (${response.challengeMethod ?? response.challenge_method ?? 'unknown'}) on ${step}: disable 2FA on that account or use a static token`);
    }
    const token = response.accessToken ?? response.access_token;
    if (!token) throw new OptaqodeServiceAccountError(`Orbit's ${step} answered without an access token`);
    const refresh = response.refreshToken ?? response.refresh_token;
    if (refresh) this.refresh = refresh;
    const expiresIn = response.expiresIn ?? response.expires_in;
    const exp = decodeJwtPayload(token)?.exp;
    const expiresAt = typeof exp === 'number' ? exp * 1000 : this.now() + (typeof expiresIn === 'number' ? expiresIn : 3600) * 1000;
    this.access = { token, expiresAt };
    return token;
  }
}

/** The static token when the backend issued one; the service account's session otherwise. */
export function createTokenSource(config: OptaqodeConfig, client?: OptaqodeClient): TokenSource {
  return config.serviceToken ? new StaticToken(config.serviceToken) : new OptaqodeServiceSession(config, client);
}
