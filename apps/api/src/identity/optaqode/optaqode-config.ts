/**
 * Configuration of the real Orbit adapters (PH-13, DEC-0045, DEC-0046). The broker is the Optaqode / "Orbit
 * Market" platform: its frontend (inspected read-only, `docs/integration/ORBIT-INTEGRATION.md`) calls a REST API
 * under `https://{,dev-}api.orbitmarket.pro/api/v1` with `Authorization: Bearer <JWT>` and snake_case bodies.
 *
 * Two credentials, two directions:
 * - the customer's own access token, forwarded by the panel, proves who the customer is. The signing secret lives
 *   only in the broker's backend (`JWT_SECRET:<authContext>`), so by default the token is verified *by the backend*:
 *   the API presents it to `GET /profiles/me` and trusts the answer (DEC-0046 a); a local secret is optional;
 * - a service account of Orbit Support in the broker's back-office (a team member the Owner creates) whose login
 *   gives the bearer for the admin read endpoints (records, staff directory) — or a static token if the backend
 *   ever issues one (DEC-0046 b).
 *
 * Every value is read at bootstrap; a missing one stops the API with the variable named, never a silent fallback.
 */
export interface OptaqodeConfig {
  /** Base URL including the version prefix, e.g. `https://dev-api.orbitmarket.pro/api/v1`. */
  apiBaseUrl: string;
  /** Static bearer for the admin read endpoints (only if the backend issues one). */
  serviceToken: string | null;
  /** The service account's login (`POST /admin/auth/login`), used when no static token exists. */
  serviceEmail: string | null;
  servicePassword: string | null;
  /** Optional local verification of customer tokens: an HS256 secret, or a JWKS URL for asymmetric tokens (never both). */
  jwtSecret: string | null;
  jwtJwksUrl: string | null;
  jwtIssuer: string | null;
  jwtAudience: string | null;
  /** Timeout of one HTTP call to the broker (a slow broker answers `unavailable: timeout`, never a hang). */
  httpTimeoutMs: number;
  /** How long the staff directory listing is reused before it is read again. */
  staffCacheMs: number;
  /** How long a token verified by the backend is trusted before it is presented again. */
  tokenCacheMs: number;
}

export const OPTAQODE_ENV = {
  apiBaseUrl: 'ORBIT_API_BASE_URL',
  serviceToken: 'ORBIT_SERVICE_TOKEN',
  serviceEmail: 'ORBIT_SERVICE_EMAIL',
  servicePassword: 'ORBIT_SERVICE_PASSWORD',
  jwtSecret: 'ORBIT_JWT_SECRET',
  jwtJwksUrl: 'ORBIT_JWT_JWKS_URL',
  jwtIssuer: 'ORBIT_JWT_ISSUER',
  jwtAudience: 'ORBIT_JWT_AUDIENCE',
  httpTimeoutMs: 'ORBIT_HTTP_TIMEOUT_MS',
  staffCacheMs: 'ORBIT_STAFF_CACHE_MS',
  tokenCacheMs: 'ORBIT_TOKEN_CACHE_MS',
} as const;

function text(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

function positive(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = text(env, name);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name}="${raw}" must be a positive integer`);
  return parsed;
}

/** What every optaqode adapter needs: the base URL. Each adapter checks its own credential on top. */
export function readOptaqodeConfig(env: NodeJS.ProcessEnv): OptaqodeConfig {
  const apiBaseUrl = text(env, OPTAQODE_ENV.apiBaseUrl);
  if (!apiBaseUrl) throw new Error(`${OPTAQODE_ENV.apiBaseUrl} is required for the optaqode adapters (e.g. https://dev-api.orbitmarket.pro/api/v1)`);
  let parsed: URL;
  try {
    parsed = new URL(apiBaseUrl);
  } catch {
    throw new Error(`${OPTAQODE_ENV.apiBaseUrl}="${apiBaseUrl}" is not a URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && !parsed.hostname.endsWith('.localhost') && !parsed.hostname.startsWith('local-')) {
    throw new Error(`${OPTAQODE_ENV.apiBaseUrl} must use https (customer tokens travel on it); plain http is allowed for localhost only`);
  }
  return {
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
    serviceToken: text(env, OPTAQODE_ENV.serviceToken),
    serviceEmail: text(env, OPTAQODE_ENV.serviceEmail),
    servicePassword: text(env, OPTAQODE_ENV.servicePassword),
    jwtSecret: text(env, OPTAQODE_ENV.jwtSecret),
    jwtJwksUrl: text(env, OPTAQODE_ENV.jwtJwksUrl),
    jwtIssuer: text(env, OPTAQODE_ENV.jwtIssuer),
    jwtAudience: text(env, OPTAQODE_ENV.jwtAudience),
    httpTimeoutMs: positive(env, OPTAQODE_ENV.httpTimeoutMs, 5000),
    staffCacheMs: positive(env, OPTAQODE_ENV.staffCacheMs, 60_000),
    tokenCacheMs: positive(env, OPTAQODE_ENV.tokenCacheMs, 60_000),
  };
}

/** Local verification is optional (the backend verifies by default); two materials at once is a mistake. */
export function requireIdentityConfig(config: OptaqodeConfig): OptaqodeConfig {
  if (config.jwtSecret && config.jwtJwksUrl) {
    throw new Error(`The optaqode identity provider takes at most one of ${OPTAQODE_ENV.jwtSecret} (HS256) or ${OPTAQODE_ENV.jwtJwksUrl} (RS256/ES256)`);
  }
  return config;
}

/** The records and directory adapters act with the service credential: a static token or the service account's login. */
export function requireServiceConfig(config: OptaqodeConfig, adapter: string): OptaqodeConfig {
  if (config.serviceToken) return config;
  if (config.serviceEmail && config.servicePassword) return config;
  throw new Error(`The optaqode ${adapter} adapter needs ${OPTAQODE_ENV.serviceToken}, or ${OPTAQODE_ENV.serviceEmail} and ${OPTAQODE_ENV.servicePassword} (the support service account in the broker's back-office)`);
}
