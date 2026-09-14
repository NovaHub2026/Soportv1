import { type DynamicModule, Module } from '@nestjs/common';
import { IdentityController } from './identity.controller.js';
import { ORBIT_IDENTITY } from './identity.types.js';
import { SimulatedOrbitIdentity } from './simulated-orbit-identity.js';
import { SimulatedStaffDirectory, STAFF_DIRECTORY } from './staff-directory.js';

export type IdentityProviderName = 'simulated';

/**
 * Chooses the identity provider from the environment and refuses unsafe combinations. The simulated
 * provider trusts plain headers, so it may only run in production with an explicit, deliberate opt-in
 * (an isolated demo). A real Orbit session adapter is added here when Orbit exists (ADR-0002, DEC-0003).
 */
export function resolveIdentityProviderName(env: NodeJS.ProcessEnv): IdentityProviderName {
  const name = env.SUPPORT_IDENTITY_PROVIDER ?? 'simulated';
  if (name !== 'simulated') {
    throw new Error(
      `Unknown identity provider "${name}". Only "simulated" exists until Orbit provides sessions (ADR-0002).`,
    );
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

@Module({})
export class IdentityModule {
  static forRoot(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    return {
      module: IdentityModule,
      global: true,
      controllers: [IdentityController],
      providers: [
        {
          provide: ORBIT_IDENTITY,
          // Evaluated at bootstrap so the environment check runs where the API actually starts.
          useFactory: () => {
            resolveIdentityProviderName(env);
            return new SimulatedOrbitIdentity();
          },
        },
        { provide: STAFF_DIRECTORY, useClass: SimulatedStaffDirectory },
      ],
      exports: [ORBIT_IDENTITY, STAFF_DIRECTORY],
    };
  }
}
