import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { trustProxySetting } from '../app.setup.js';
import {
  type AccessRecoveryInput,
  type AccessRecoveryListQuery,
  type AccessRecoveryOutcomeInput,
  type AccessRecoveryReceipt,
  type AccessRecoveryRequest,
  accessRecoveryInputSchema,
  accessRecoveryListQuerySchema,
  accessRecoveryOutcomeSchema,
} from '@orbit-support/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentActor, StaffGuard } from '../identity/guards.js';
import type { StaffActor } from '../identity/identity.types.js';
import { AccessRecoveryService } from './access-recovery.service.js';

/**
 * The only unauthenticated write surface of the API (PH-7.1, §4.5): no identity is required or read, and the
 * response reveals nothing about any account. Abuse is bounded by the service's working limits (429).
 */
@Controller('public/access-recovery')
export class PublicAccessController {
  constructor(private readonly recovery: AccessRecoveryService) {}

  @Post()
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(accessRecoveryInputSchema)) input: AccessRecoveryInput, @Req() request: Request): Promise<AccessRecoveryReceipt> {
    // A client address only when an appending proxy reports it (`SUPPORT_TRUST_PROXY`, BL-026): without one every
    // request would carry the web's address, and a per-client limit would close the route for everybody at once.
    const client = trustProxySetting() === false ? null : (request.ip ?? null);
    return this.recovery.create(input, new Date(), client);
  }
}

/** Staff handling of recovery requests: list by status and record one attributable outcome. */
@Controller('staff/access-recovery')
@UseGuards(StaffGuard)
export class StaffAccessController {
  constructor(private readonly recovery: AccessRecoveryService) {}

  @Get()
  list(@Query(new ZodValidationPipe(accessRecoveryListQuerySchema)) query: AccessRecoveryListQuery): Promise<AccessRecoveryRequest[]> {
    return this.recovery.list(query.status);
  }

  @Post(':id/handle')
  @HttpCode(200)
  handle(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(accessRecoveryOutcomeSchema)) input: AccessRecoveryOutcomeInput,
  ): Promise<AccessRecoveryRequest> {
    return this.recovery.handle(actor, id, input);
  }
}
