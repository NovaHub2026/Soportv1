import type { IncomingHttpHeaders } from 'node:http';
import type { IdentitySource, StaffRole } from '@orbit-support/shared';

export interface CustomerActor {
  kind: 'customer';
  /** Stable Orbit user id — the primary customer reference (PROJECT_CONTEXT.md §6.1). */
  id: string;
  source: IdentitySource;
}

export interface StaffActor {
  kind: 'staff';
  id: string;
  role: StaffRole;
  displayName: string;
  source: IdentitySource;
}

export type Actor = CustomerActor | StaffActor;

/**
 * Orbit boundary (ADR-0002): the only way the API learns who is calling. Today the sole implementation
 * is the simulated provider (DEC-0003); a real Orbit session adapter replaces it without touching callers.
 */
export interface OrbitIdentityPort {
  resolve(headers: IncomingHttpHeaders): Promise<Actor | null>;
}

export const ORBIT_IDENTITY = Symbol('ORBIT_IDENTITY');
