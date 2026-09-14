import { type DynamicModule, Module } from '@nestjs/common';
import { CompositeIdentity } from './composite-identity.js';
import { IdentityController } from './identity.controller.js';
import { ORBIT_IDENTITY, type OrbitIdentityPort } from './identity.types.js';
import { SimulatedOrbitIdentity } from './simulated-orbit-identity.js';
import { ORBIT_RECORDS, type OrbitRecordsPort } from './orbit-records.js';
import { SimulatedOrbitRecords } from './simulated-orbit-records.js';
import { SimulatedStaffDirectory, STAFF_DIRECTORY, type StaffDirectory } from './staff-directory.js';
import { OptaqodeClient } from './optaqode/optaqode-client.js';
import { type OptaqodeConfig, readOptaqodeConfig, requireIdentityConfig, requireServiceConfig } from './optaqode/optaqode-config.js';
import { OptaqodeIdentity } from './optaqode/optaqode-identity.js';
import { OptaqodeRecords } from './optaqode/optaqode-records.js';
import { createTokenSource, type TokenSource } from './optaqode/optaqode-service-session.js';
import { OptaqodeStaffDirectory } from './optaqode/optaqode-staff-directory.js';

interface OptaqodeShared {
  config: OptaqodeConfig;
  client: OptaqodeClient;
  session: TokenSource | null;
}
const OPTAQODE_SHARED = Symbol('OPTAQODE_SHARED');

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

/** Simulated staff beside the real customer path (PH-13.3 demo, DEC-0047): `SUPPORT_SIMULATED_STAFF=true`. */
export function simulatedStaffRequested(env: NodeJS.ProcessEnv): boolean {
  return env.SUPPORT_SIMULATED_STAFF?.trim().toLowerCase() === 'true';
}

function refuseSimulationInProduction(env: NodeJS.ProcessEnv, what: string): void {
  // Case-insensitive: "Production" must not slip past the guard (Cycle Audit 1, FND-0018).
  if (env.NODE_ENV?.trim().toLowerCase() === 'production' && env.SUPPORT_ALLOW_SIMULATED_IDENTITY !== 'true') {
    throw new Error(
      `Refusing to start: ${what} trusts request headers and must not run in production. ` +
        'Set SUPPORT_ALLOW_SIMULATED_IDENTITY=true only for a deliberately isolated demo.',
    );
  }
}

/**
 * Chooses the identity provider from the environment and refuses unsafe combinations. The simulated
 * provider trusts plain headers, so it may only run in production with an explicit, deliberate opt-in
 * (an isolated demo). The `optaqode` provider proves the broker's tokens and needs its configuration.
 */
export function resolveIdentityProviderName(env: NodeJS.ProcessEnv): IdentityProviderName {
  const name = adapterName(env, 'SUPPORT_IDENTITY_PROVIDER', 'identity provider');
  if (name === 'optaqode') {
    requireIdentityConfig(readOptaqodeConfig(env));
    if (simulatedStaffRequested(env)) refuseSimulationInProduction(env, 'the simulated staff picker (SUPPORT_SIMULATED_STAFF)');
    return name;
  }
  refuseSimulationInProduction(env, 'the simulated identity provider');
  return name;
}

/** What `/api/health` reports: simulation is never hidden (DEC-0003) — a demo composition says so by name. */
export function describeAdapters(env: NodeJS.ProcessEnv = process.env): { identity: string; orbitRecords: AdapterName; staffDirectory: AdapterName } {
  const identity = resolveIdentityProviderName(env);
  return {
    identity: identity === 'optaqode' && simulatedStaffRequested(env) ? 'optaqode+simulated-staff' : identity,
    orbitRecords: resolveOrbitRecordsName(env),
    staffDirectory: resolveStaffDirectoryName(env),
  };
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
          // One client and one service session shared by the adapters that read as Orbit Support (DEC-0046 b).
          provide: OPTAQODE_SHARED,
          useFactory: (): OptaqodeShared | null => {
            if (resolveOrbitRecordsName(env) !== 'optaqode' && resolveStaffDirectoryName(env) !== 'optaqode' && resolveIdentityProviderName(env) !== 'optaqode') return null;
            const config = readOptaqodeConfig(env);
            const client = new OptaqodeClient(config);
            const needsService = resolveOrbitRecordsName(env) === 'optaqode' || resolveStaffDirectoryName(env) === 'optaqode';
            return { config, client, session: needsService ? createTokenSource(requireServiceConfig(config, 'records/staff directory'), client) : null };
          },
        },
        {
          provide: STAFF_DIRECTORY,
          useFactory: (shared: OptaqodeShared | null): StaffDirectory => (resolveStaffDirectoryName(env) === 'optaqode' && shared?.session ? new OptaqodeStaffDirectory(shared.config, shared.client, shared.session) : new SimulatedStaffDirectory()),
          inject: [OPTAQODE_SHARED],
        },
        {
          provide: ORBIT_IDENTITY,
          // Evaluated at bootstrap so the environment check runs where the API actually starts.
          useFactory: (staff: StaffDirectory, shared: OptaqodeShared | null): OrbitIdentityPort => {
            if (resolveIdentityProviderName(env) !== 'optaqode' || !shared) return new SimulatedOrbitIdentity();
            const real = new OptaqodeIdentity(shared.config, staff, shared.client);
            return simulatedStaffRequested(env) ? new CompositeIdentity(real, new SimulatedOrbitIdentity()) : real;
          },
          inject: [STAFF_DIRECTORY, OPTAQODE_SHARED],
        },
        {
          provide: ORBIT_RECORDS,
          useFactory: (shared: OptaqodeShared | null): OrbitRecordsPort => (resolveOrbitRecordsName(env) === 'optaqode' && shared?.session ? new OptaqodeRecords(shared.config, shared.client, shared.session) : new SimulatedOrbitRecords(env)),
          inject: [OPTAQODE_SHARED],
        },
      ],
      exports: [ORBIT_IDENTITY, STAFF_DIRECTORY, ORBIT_RECORDS],
    };
  }
}
