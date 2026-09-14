import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnyActorGuard, CurrentActor } from './guards.js';
import type { Actor } from './identity.types.js';

/** Who am I, as the API sees it — including `source`, so every client can label a simulated session. */
@Controller('identity')
@UseGuards(AnyActorGuard)
export class IdentityController {
  @Get('me')
  me(@CurrentActor() actor: Actor): Actor {
    return actor;
  }
}
