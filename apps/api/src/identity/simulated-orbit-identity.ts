import type { IncomingHttpHeaders } from 'node:http';
import { Injectable } from '@nestjs/common';
import { SIMULATED_IDENTITY_HEADERS, STAFF_ROLES, type StaffRole } from '@orbit-support/shared';
import type { Actor, OrbitIdentityPort } from './identity.types.js';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const raw = headers[name];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value : undefined;
}

/**
 * SIMULATED identity: trusts plain request headers. Only acceptable while Orbit does not exist (DEC-0003).
 * Every actor it returns carries `source: 'simulated'` so UI and logs can label it honestly.
 */
@Injectable()
export class SimulatedOrbitIdentity implements OrbitIdentityPort {
  async resolve(headers: IncomingHttpHeaders): Promise<Actor | null> {
    const customerId = header(headers, SIMULATED_IDENTITY_HEADERS.customerId);
    const staffId = header(headers, SIMULATED_IDENTITY_HEADERS.staffId);
    if (customerId && staffId) return null; // ambiguous: refuse rather than guess

    if (customerId) {
      return ID_PATTERN.test(customerId) ? { kind: 'customer', id: customerId, source: 'simulated' } : null;
    }
    if (staffId) {
      if (!ID_PATTERN.test(staffId)) return null;
      const role = header(headers, SIMULATED_IDENTITY_HEADERS.staffRole) ?? 'agent';
      if (!(STAFF_ROLES as readonly string[]).includes(role)) return null;
      return {
        kind: 'staff',
        id: staffId,
        role: role as StaffRole,
        displayName: header(headers, SIMULATED_IDENTITY_HEADERS.staffName) ?? staffId,
        source: 'simulated',
      };
    }
    return null;
  }
}
