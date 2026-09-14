import type { IncomingHttpHeaders } from 'node:http';
import { Logger } from '@nestjs/common';
import type { Actor, OrbitIdentityPort } from '../identity.types.js';
import type { StaffDirectory } from '../staff-directory.js';
import { createJwtVerifier, type JwtPayload, type JwtVerifier } from './optaqode-jwt.js';
import { type OptaqodeConfig, requireIdentityConfig } from './optaqode-config.js';

/** A broker id: `PRF_…`, a UUID or a code — letters, digits and a few separators, bounded (the case tables key on it). */
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

/** The claim that carries the person id: the backend's choice (open question Q3); the candidates in order. */
const ID_CLAIMS = ['sub', 'person_id', 'personId', 'user_id', 'userId', 'id'] as const;

export const ORBIT_ACTOR_HEADER = 'x-orbit-actor';

/**
 * Real identity (PH-13, DEC-0045 a): the panel forwards the customer's own broker access token as
 * `Authorization: Bearer …`; the token is verified here (signature, expiry, issuer, audience) and the person id
 * claim becomes the customer id. A back-office token with `x-orbit-actor: staff` resolves through the staff
 * directory, which decides the role — never the token (the frontend's `isDevAdmin`/`isCoreDev` claims are not
 * support roles). Nothing else in the API changes: callers still see a `CustomerActor` / `StaffActor`.
 */
export class OptaqodeIdentity implements OrbitIdentityPort {
  private readonly logger = new Logger(OptaqodeIdentity.name);
  private readonly verifier: JwtVerifier;

  constructor(
    config: OptaqodeConfig,
    private readonly staff: StaffDirectory,
    verifier?: JwtVerifier,
  ) {
    this.verifier = verifier ?? createJwtVerifier(requireIdentityConfig(config));
  }

  async resolve(headers: IncomingHttpHeaders): Promise<Actor | null> {
    const token = bearer(headers.authorization);
    if (!token) return null;
    const payload = await this.verifier.verify(token);
    if (!payload) return null;
    const id = personId(payload);
    if (!id) {
      this.logger.warn('Orbit token verified but carries no person id claim (sub/person_id/user_id)');
      return null;
    }
    const actorHeader = String(headers[ORBIT_ACTOR_HEADER] ?? '').trim().toLowerCase();
    if (actorHeader === 'staff') {
      const member = await this.staff.roleOf(id);
      if (!member) return null; // a back-office user who is not in the support directory is nobody here
      const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : id;
      return { kind: 'staff', id, role: member.role, displayName: name, source: 'orbit' };
    }
    return { kind: 'customer', id, source: 'orbit' };
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
