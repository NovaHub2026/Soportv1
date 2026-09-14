import type { IncomingHttpHeaders } from 'node:http';
import { SIMULATED_IDENTITY_HEADERS } from '@orbit-support/shared';
import type { Actor, OrbitIdentityPort } from './identity.types.js';

/**
 * Demo composition (PH-13.3, DEC-0047): customers come through the real path (a bearer the `optaqode` provider
 * proves with the broker — real or simulated) while staff keep the labeled simulated picker
 * (`x-simulated-staff-id`), because no staff surface inside the broker's back-office exists yet. Only staff
 * headers are honoured from the simulated side — a simulated *customer* header is refused, so the customer
 * path is never bypassed. Selected with `SUPPORT_SIMULATED_STAFF=true`, which is subject to the same production
 * refusal as the simulated provider (DEC-0008).
 */
export class CompositeIdentity implements OrbitIdentityPort {
  constructor(
    private readonly bearerProvider: OrbitIdentityPort,
    private readonly simulated: OrbitIdentityPort,
  ) {}

  async resolve(headers: IncomingHttpHeaders): Promise<Actor | null> {
    if (headers.authorization) return this.bearerProvider.resolve(headers);
    if (headers[SIMULATED_IDENTITY_HEADERS.customerId]) return null;
    if (!headers[SIMULATED_IDENTITY_HEADERS.staffId]) return null;
    const actor = await this.simulated.resolve(headers);
    return actor?.kind === 'staff' ? actor : null;
  }
}
