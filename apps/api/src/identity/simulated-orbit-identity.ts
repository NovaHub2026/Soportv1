import type { IncomingHttpHeaders } from 'node:http';
import { Injectable } from '@nestjs/common';
import { findSimulatedStaff, SIMULATED_IDENTITY_HEADERS, STAFF_ROLES, type StaffRole } from '@orbit-support/shared';
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
      // Only members of the (simulated) directory are staff; the directory's role wins over the header (PH-7.2, DEC-0029).
      const member = findSimulatedStaff(staffId);
      if (!member) return null;
      const claimed = header(headers, SIMULATED_IDENTITY_HEADERS.staffRole);
      if (claimed && !(STAFF_ROLES as readonly string[]).includes(claimed)) return null;
      if (claimed && claimed !== member.role) console.warn(`simulated identity: header role "${claimed}" ignored for ${staffId} (directory says ${member.role})`);
      const role: StaffRole = member.role;
      return {
        kind: 'staff',
        id: staffId,
        role,
        // The directory's name, never a header: customers read it, and a header let an agent post as someone else
        // (Cycle Audit 3; supersedes the FND-0048 bound). `x-simulated-staff-name` is ignored.
        displayName: member.name,
        source: 'simulated',
      };
    }
    return null;
  }
}

