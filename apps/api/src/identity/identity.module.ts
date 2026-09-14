import { Global, Module } from '@nestjs/common';
import { ORBIT_IDENTITY } from './identity.types.js';
import { SimulatedOrbitIdentity } from './simulated-orbit-identity.js';

@Global()
@Module({
  providers: [{ provide: ORBIT_IDENTITY, useClass: SimulatedOrbitIdentity }],
  exports: [ORBIT_IDENTITY],
})
export class IdentityModule {}
