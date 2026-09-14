import { createHmac, createPublicKey, timingSafeEqual, verify as verifySignature, type KeyObject } from 'node:crypto';
import type { OptaqodeConfig } from './optaqode-config.js';

/**
 * Verification of the broker's access token (PH-13). Its frontend only decodes the payload (`exp`, `isDevAdmin`,
 * `isCoreDev`); the signing algorithm, issuer and audience are the backend's (open question Q2/Q3 of the map),
 * so both materials are supported: an HS256 shared secret, or a JWKS document for RS256 / ES256. No library:
 * Node's `crypto` verifies HMAC and public-key signatures and imports JWKs natively.
 */
export interface JwtPayload {
  sub?: string;
  exp?: number;
  nbf?: number;
  iss?: string;
  aud?: string | string[];
  [claim: string]: unknown;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface Jwk {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  [field: string]: unknown;
}

export type JwksFetch = (url: string) => Promise<{ keys: Jwk[] }>;

const ALGORITHMS: Record<string, { kind: 'hmac' | 'rsa' | 'ec'; hash: string }> = {
  HS256: { kind: 'hmac', hash: 'sha256' },
  RS256: { kind: 'rsa', hash: 'sha256' },
  ES256: { kind: 'ec', hash: 'sha256' },
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function decodePart<T>(part: string): T | null {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** Only for tests and local tooling: an HS256 token with the given payload. */
export function signHs256(payload: JwtPayload, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export class JwksCache {
  private keys: Jwk[] = [];
  private fetchedAt = 0;

  constructor(
    private readonly url: string,
    private readonly fetchJwks: JwksFetch,
    private readonly ttlMs = 10 * 60_000,
  ) {}

  async find(kid: string | undefined): Promise<KeyObject | null> {
    const now = Date.now();
    if (now - this.fetchedAt > this.ttlMs || this.keys.length === 0) await this.refresh();
    let key = this.pick(kid);
    if (!key && kid) {
      // An unknown kid may mean the broker rotated its keys since the last read: read once more, then give up.
      await this.refresh();
      key = this.pick(kid);
    }
    if (!key) return null;
    try {
      return createPublicKey({ key: key as never, format: 'jwk' });
    } catch {
      return null;
    }
  }

  private pick(kid: string | undefined): Jwk | undefined {
    if (kid) return this.keys.find((k) => k.kid === kid);
    return this.keys.length === 1 ? this.keys[0] : undefined;
  }

  private async refresh(): Promise<void> {
    const document = await this.fetchJwks(this.url);
    this.keys = Array.isArray(document?.keys) ? document.keys : [];
    this.fetchedAt = Date.now();
  }
}

export interface JwtVerifier {
  verify(token: string): Promise<JwtPayload | null>;
}

/** Signature, time window, issuer and audience checked; anything else about the token is the caller's. */
export function createJwtVerifier(config: OptaqodeConfig, fetchJwks?: JwksFetch, now: () => number = () => Date.now()): JwtVerifier {
  const jwks = config.jwtJwksUrl ? new JwksCache(config.jwtJwksUrl, fetchJwks ?? defaultJwksFetch) : null;
  return {
    async verify(token: string): Promise<JwtPayload | null> {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [headerPart, payloadPart, signaturePart] = parts;
      const header = decodePart<JwtHeader>(headerPart);
      const payload = decodePart<JwtPayload>(payloadPart);
      if (!header || !payload || typeof header.alg !== 'string') return null;
      const algorithm = ALGORITHMS[header.alg];
      if (!algorithm) return null;
      const signed = Buffer.from(`${headerPart}.${payloadPart}`);
      let signature: Buffer;
      try {
        signature = Buffer.from(signaturePart, 'base64url');
      } catch {
        return null;
      }
      if (algorithm.kind === 'hmac') {
        if (!config.jwtSecret) return null;
        const expected = createHmac(algorithm.hash, config.jwtSecret).update(signed).digest();
        if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) return null;
      } else {
        if (!jwks) return null;
        const key = await jwks.find(header.kid);
        if (!key) return null;
        const options = algorithm.kind === 'ec' ? { key, dsaEncoding: 'ieee-p1363' as const } : key;
        if (!verifySignature(algorithm.hash, signed, options, signature)) return null;
      }
      const seconds = Math.floor(now() / 1000);
      if (typeof payload.exp !== 'number' || payload.exp <= seconds) return null;
      if (typeof payload.nbf === 'number' && payload.nbf > seconds + 60) return null;
      if (config.jwtIssuer && payload.iss !== config.jwtIssuer) return null;
      if (config.jwtAudience) {
        const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
        if (!audiences.includes(config.jwtAudience)) return null;
      }
      return payload;
    },
  };
}

async function defaultJwksFetch(url: string): Promise<{ keys: Jwk[] }> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (response.status !== 200) throw new Error(`JWKS ${url} answered ${response.status}`);
  return (await response.json()) as { keys: Jwk[] };
}
