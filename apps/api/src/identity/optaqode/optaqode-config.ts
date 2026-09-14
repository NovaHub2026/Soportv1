/**
 * Configuration of the real Orbit adapters (PH-13, DEC-0045). The broker is the Optaqode / "Orbit Market" platform:
 * its frontend (inspected read-only, `docs/integration/ORBIT-INTEGRATION.md`) calls a REST API under
 * `https://{,dev-}api.orbitmarket.pro/api/v1` with `Authorization: Bearer <JWT>` and snake_case bodies.
 *
 * Two credentials, two directions:
 * - the customer's own access token, forwarded by the panel, proves who the customer is (identity);
 * - a service credential of Orbit Support reads the customer 360 and the staff directory through the admin
 *   read endpoints (records, directory) — the backend has to issue it (open question Q2/Q17 of the map).
 *
 * Every value is read at bootstrap; a missing one stops the API with the variable named, never a silent fallback.
 */
export interface OptaqodeConfig {
  /** Base URL including the version prefix, e.g. `https://dev-api.orbitmarket.pro/api/v1`. */
  apiBaseUrl: string;
  /** Bearer credential Orbit Support uses server-to-server (records, staff directory). */
  serviceToken: string | null;
  /** HS256 shared secret — or, instead, a JWKS URL for asymmetric tokens. Exactly one of the two. */
  jwtSecret: string | null;
  jwtJwksUrl: string | null;
  jwtIssuer: string | null;
  jwtAudience: string | null;
  /** Timeout of one HTTP call to the broker (a slow broker answers `unavailable: timeout`, never a hang). */
  httpTimeoutMs: number;
  /** How long the staff directory listing is reused before it is read again. */
  staffCacheMs: number;
}

export const OPTAQODE_ENV = {
  apiBaseUrl: 'ORBIT_API_BASE_URL',
  serviceToken: 'ORBIT_SERVICE_TOKEN',
  jwtSecret: 'ORBIT_JWT_SECRET',
  jwtJwksUrl: 'ORBIT_JWT_JWKS_URL',
  jwtIssuer: 'ORBIT_JWT_ISSUER',
  jwtAudience: 'ORBIT_JWT_AUDIENCE',
  httpTimeoutMs: 'ORBIT_HTTP_TIMEOUT_MS',
  staffCacheMs: 'ORBIT_STAFF_CACHE_MS',
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
    jwtSecret: text(env, OPTAQODE_ENV.jwtSecret),
    jwtJwksUrl: text(env, OPTAQODE_ENV.jwtJwksUrl),
    jwtIssuer: text(env, OPTAQODE_ENV.jwtIssuer),
    jwtAudience: text(env, OPTAQODE_ENV.jwtAudience),
    httpTimeoutMs: positive(env, OPTAQODE_ENV.httpTimeoutMs, 5000),
    staffCacheMs: positive(env, OPTAQODE_ENV.staffCacheMs, 60_000),
  };
}

/** The identity adapter verifies customer tokens itself: it needs exactly one verification material. */
export function requireIdentityConfig(config: OptaqodeConfig): OptaqodeConfig {
  if (Boolean(config.jwtSecret) === Boolean(config.jwtJwksUrl)) {
    throw new Error(`The optaqode identity provider needs exactly one of ${OPTAQODE_ENV.jwtSecret} (HS256) or ${OPTAQODE_ENV.jwtJwksUrl} (RS256/ES256)`);
  }
  return config;
}

/** The records and directory adapters act with the service credential. */
export function requireServiceConfig(config: OptaqodeConfig, adapter: string): OptaqodeConfig & { serviceToken: string } {
  if (!config.serviceToken) throw new Error(`${OPTAQODE_ENV.serviceToken} is required for the optaqode ${adapter} adapter`);
  return { ...config, serviceToken: config.serviceToken };
}
