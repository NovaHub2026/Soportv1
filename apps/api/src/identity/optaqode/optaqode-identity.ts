import { createHash } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { Logger } from '@nestjs/common';
import type { Actor, OrbitIdentityPort } from '../identity.types.js';
import type { StaffDirectory } from '../staff-directory.js';
import { OptaqodeClient, OptaqodeHttpError, OptaqodeTimeoutError } from './optaqode-client.js';
import { type OptaqodeConfig, requireIdentityConfig } from './optaqode-config.js';
import { createJwtVerifier, decodeJwtPayload, type JwtPayload, type JwtVerifier } from './optaqode-jwt.js';
import type { OptaqodeProfile } from './optaqode-mappers.js';

/** A broker id: `PRF_…`, a UUID or a code — letters, digits and a few separators, bounded (the case tables key on it). */
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

/** The claim that carries the person id when the token is verified locally; the candidates in order (map §7 Q2). */
const ID_CLAIMS = ['sub', 'person_id', 'personId', 'user_id', 'userId', 'id'] as const;

export const ORBIT_ACTOR_HEADER = 'x-orbit-actor';
const CACHE_MAX = 5000;

/**
 * Real identity (PH-13, DEC-0045 a, DEC-0046 a): the panel forwards the customer's own broker access token as
 * `Authorization: Bearer …`. By default the token is verified by the broker itself — presented to `GET /profiles/me`;
 * an accepted answer proves the token (the backend checked the signature) and names the customer by the profile's
 * `id`, the canonical id. With `ORBIT_JWT_SECRET` / `ORBIT_JWT_JWKS_URL` the signature is checked here instead and
 * the id comes from the token's claim. A back-office token with `x-orbit-actor: staff` is proven the same way
 * (one admin read) and resolves through the staff directory, which decides the role — never a token claim.
 * Verified tokens are trusted for `ORBIT_TOKEN_CACHE_MS`, keyed by a hash of the token (never the token itself).
 */
export class OptaqodeIdentity implements OrbitIdentityPort {
  private readonly logger = new Logger(OptaqodeIdentity.name);
  private readonly verifier: JwtVerifier | null;
  private readonly cache = new Map<string, { actor: Actor; until: number }>();

  constructor(
    private readonly config: OptaqodeConfig,
    private readonly staff: StaffDirectory,
    private readonly client: OptaqodeClient = new OptaqodeClient(config),
    verifier?: JwtVerifier,
    private readonly now: () => number = () => Date.now(),
  ) {
    requireIdentityConfig(config);
    this.verifier = verifier ?? (config.jwtSecret || config.jwtJwksUrl ? createJwtVerifier(config) : null);
  }

  async resolve(headers: IncomingHttpHeaders): Promise<Actor | null> {
    const token = bearer(headers.authorization);
    if (!token) return null;
    const wantsStaff = String(headers[ORBIT_ACTOR_HEADER] ?? '').trim().toLowerCase() === 'staff';
    const key = `${wantsStaff ? 's' : 'c'}:${createHash('sha256').update(token).digest('base64url')}`;
    const cached = this.cache.get(key);
    if (cached && cached.until > this.now()) return cached.actor;
    const actor = this.verifier ? await this.resolveLocally(token, wantsStaff) : await this.resolveWithBroker(token, wantsStaff);
    if (actor) this.remember(key, actor);
    return actor;
  }

  /** Local signature check: the id is the token's claim. */
  private async resolveLocally(token: string, wantsStaff: boolean): Promise<Actor | null> {
    const payload = await this.verifier!.verify(token);
    if (!payload) return null;
    const id = personId(payload);
    if (!id) {
      this.logger.warn('Orbit token verified but carries no person id claim (sub/person_id/user_id)');
      return null;
    }
    return wantsStaff ? this.staffActor(id, payload) : { kind: 'customer', id, source: 'orbit' };
  }

  /** Verification by the broker: one authenticated read with the token; an accepted answer proves it. */
  private async resolveWithBroker(token: string, wantsStaff: boolean): Promise<Actor | null> {
    try {
      if (!wantsStaff) {
        const profile = await this.client.get<OptaqodeProfile>('/profiles/me', { token });
        const id = typeof profile?.id === 'string' && ID.test(profile.id) ? profile.id : null;
        return id ? { kind: 'customer', id, source: 'orbit' } : null;
      }
      // Any admin read the broker accepts proves the token; the payload the broker signed then names the member.
      await this.client.get('/admin/team-members?page=1&limit=1', { token });
      const payload = decodeJwtPayload(token);
      const id = payload ? personId(payload) : null;
      return id ? this.staffActor(id, payload!) : null;
    } catch (error) {
      if (error instanceof OptaqodeHttpError && (error.status === 401 || error.status === 403)) return null;
      // The broker being down is not "not signed in": the guard answers 401 either way, but the log says why.
      this.logger.warn(`Orbit could not verify a token: ${error instanceof OptaqodeTimeoutError ? 'timeout' : error instanceof OptaqodeHttpError ? `${error.status} ${error.code ?? ''}` : error instanceof Error ? error.name : 'unknown'}`);
      return null;
    }
  }

  private async staffActor(id: string, payload: JwtPayload): Promise<Actor | null> {
    const member = await this.staff.roleOf(id);
    if (!member) return null; // a back-office user who is not in the support directory is nobody here
    const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim().slice(0, 80) : id;
    return { kind: 'staff', id, role: member.role, displayName: name, source: 'orbit' };
  }

  private remember(key: string, actor: Actor): void {
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { actor, until: this.now() + this.config.tokenCacheMs });
  }
}

function bearer(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  return match ? match[1] : null;
}

function personId(payload: JwtPayload): string | null {
  for (const claim of ID_CLAIMS) {
    const value = payload[claim];
    if (typeof value === 'string' && ID.test(value)) return value;
  }
  return null;
}
