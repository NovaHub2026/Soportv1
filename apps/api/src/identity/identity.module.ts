import { type DynamicModule, Module } from '@nestjs/common';
import { IdentityController } from './identity.controller.js';
import { ORBIT_IDENTITY, type OrbitIdentityPort } from './identity.types.js';
import { SimulatedOrbitIdentity } from './simulated-orbit-identity.js';
import { ORBIT_RECORDS, type OrbitRecordsPort } from './orbit-records.js';
import { SimulatedOrbitRecords } from './simulated-orbit-records.js';
import { SimulatedStaffDirectory, STAFF_DIRECTORY, type StaffDirectory } from './staff-directory.js';
import { readOptaqodeConfig, requireIdentityConfig, requireServiceConfig } from './optaqode/optaqode-config.js';
import { OptaqodeIdentity } from './optaqode/optaqode-identity.js';
import { OptaqodeRecords } from './optaqode/optaqode-records.js';
import { OptaqodeStaffDirectory } from './optaqode/optaqode-staff-directory.js';

/** `simulated` (DEC-0003) or `optaqode` — the broker's real API behind the same ports (PH-13, DEC-0045). */
export const ADAPTER_NAMES = ['simulated', 'optaqode'] as const;
export type AdapterName = (typeof ADAPTER_NAMES)[number];
export type IdentityProviderName = AdapterName;

function adapterName(env: NodeJS.ProcessEnv, variable: string, what: string): AdapterName {
  const name = env[variable]?.trim() || 'simulated';
  if (!(ADAPTER_NAMES as readonly string[]).includes(name)) {
    throw new Error(`Unknown ${what} "${name}" in ${variable}. Known: ${ADAPTER_NAMES.join(', ')} (ADR-0002, DEC-0045).`);
  }
  return name as AdapterName;
}

/** Records adapter selection (PH-4.1; PH-13). */
export function resolveOrbitRecordsName(env: NodeJS.ProcessEnv): AdapterName {
  const name = adapterName(env, 'SUPPORT_ORBIT_RECORDS', 'Orbit records adapter');
  if (name === 'optaqode') requireServiceConfig(readOptaqodeConfig(env), 'records');
  return name;
}

/** Staff directory selection (PH-13): defaults to the records adapter's choice so one variable configures a real broker. */
export function resolveStaffDirectoryName(env: NodeJS.ProcessEnv): AdapterName {
  const name = env.SUPPORT_STAFF_DIRECTORY?.trim() ? adapterName(env, 'SUPPORT_STAFF_DIRECTORY', 'staff directory') : resolveOrbitRecordsName(env);
  if (name === 'optaqode') requireServiceConfig(readOptaqodeConfig(env), 'staff directory');
  return name;
}

/**
 * Chooses the identity provider from the environment and refuses unsafe combinations. The simulated
 * provider trusts plain headers, so it may only run in production with an explicit, deliberate opt-in
 * (an isolated demo). The `optaqode` provider verifies the broker's tokens itself and needs its material.
 */
export function resolveIdentityProviderName(env: NodeJS.ProcessEnv): IdentityProviderName {
  const name = adapterName(env, 'SUPPORT_IDENTITY_PROVIDER', 'identity provider');
  if (name === 'optaqode') {
    requireIdentityConfig(readOptaqodeConfig(env));
    return name;
  }
  // Case-insensitive: "Production" must not slip past the guard (Cycle Audit 1, FND-0018).
  if (env.NODE_ENV?.trim().toLowerCase() === 'production' && env.SUPPORT_ALLOW_SIMULATED_IDENTITY !== 'true') {
    throw new Error(
      'Refusing to start: the simulated identity provider trusts request headers and must not run in production. ' +
        'Set SUPPORT_ALLOW_SIMULATED_IDENTITY=true only for a deliberately isolated demo.',
    );
  }
  return name;
}

/** What `/api/health` reports: simulation is never hidden (DEC-0003). */
export function describeAdapters(env: NodeJS.ProcessEnv = process.env): { identity: AdapterName; orbitRecords: AdapterName; staffDirectory: AdapterName } {
  return { identity: resolveIdentityProviderName(env), orbitRecords: resolveOrbitRecordsName(env), staffDirectory: resolveStaffDirectoryName(env) };
}

@Module({})
export class IdentityModule {
  static forRoot(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    return {
      module: IdentityModule,
      global: true,
      controllers: [IdentityController],
      providers: [
        {
          provide: STAFF_DIRECTORY,
          useFactory: (): StaffDirectory => (resolveStaffDirectoryName(env) === 'optaqode' ? new OptaqodeStaffDirectory(readOptaqodeConfig(env)) : new SimulatedStaffDirectory()),
        },
        {
          provide: ORBIT_IDENTITY,
          // Evaluated at bootstrap so the environment check runs where the API actually starts.
          useFactory: (staff: StaffDirectory): OrbitIdentityPort => (resolveIdentityProviderName(env) === 'optaqode' ? new OptaqodeIdentity(readOptaqodeConfig(env), staff) : new SimulatedOrbitIdentity()),
          inject: [STAFF_DIRECTORY],
        },
        {
          provide: ORBIT_RECORDS,
          useFactory: (): OrbitRecordsPort => (resolveOrbitRecordsName(env) === 'optaqode' ? new OptaqodeRecords(readOptaqodeConfig(env)) : new SimulatedOrbitRecords(env)),
        },
      ],
      exports: [ORBIT_IDENTITY, STAFF_DIRECTORY, ORBIT_RECORDS],
    };
  }
}
