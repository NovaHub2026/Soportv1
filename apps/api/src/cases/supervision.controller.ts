import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import {
  type Availability,
  type ServiceMetrics,
  type SupervisionOverview,
  type SupportSettings,
  type SupportSettingsInput,
  supportSettingsInputSchema,
} from '@orbit-support/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentActor, CustomerGuard, StaffGuard } from '../identity/guards.js';
import type { StaffActor } from '../identity/identity.types.js';
import { SettingsService } from './settings.service.js';
import { SupervisionService } from './supervision.service.js';

const periodSchema = z.coerce.number().int().min(1).max(90).default(7);

/** Operating configuration (PH-5.4): every staff member may read it; supervisors and admins change it. */
@Controller('staff/settings')
@UseGuards(StaffGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<SupportSettings> {
    return this.settings.get();
  }

  @Put()
  update(@CurrentActor() actor: StaffActor, @Body(new ZodValidationPipe(supportSettingsInputSchema)) input: SupportSettingsInput): Promise<SupportSettings> {
    return this.settings.update(actor, input);
  }
}

/** Supervision (PH-5.4, §5.4): demand overview and service metrics for supervisors and admins. */
@Controller('staff')
@UseGuards(StaffGuard)
export class SupervisionController {
  constructor(private readonly supervision: SupervisionService) {}

  @Get('overview')
  overview(@CurrentActor() actor: StaffActor): Promise<SupervisionOverview> {
    return this.supervision.overview(actor);
  }

  @Get('metrics')
  metrics(@CurrentActor() actor: StaffActor, @Query('days', new ZodValidationPipe(periodSchema)) days: number): Promise<ServiceMetrics> {
    return this.supervision.metrics(actor, days);
  }
}

/** What customers may know about availability (§4.4): computed from the configured schedule, never a promise. */
@Controller('support/availability')
@UseGuards(CustomerGuard)
export class AvailabilityController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  availability(): Promise<Availability> {
    return this.settings.availability();
  }
}
