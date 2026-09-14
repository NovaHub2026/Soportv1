import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  createIncidentSchema,
  type CreateIncidentInput,
  type Incident,
  INCIDENT_STATUSES,
  incidentNoteSchema,
  type IncidentNoteInput,
  type IncidentStatus,
} from '@orbit-support/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentActor, StaffGuard } from '../identity/guards.js';
import type { StaffActor } from '../identity/identity.types.js';
import { CasesService } from './cases.service.js';

const statusFilterSchema = z.enum(INCIDENT_STATUSES).optional();

/** Shared incidents (PH-3.5, context §5.4). Staff only; customers never see incidents directly. */
@Controller('staff/incidents')
@UseGuards(StaffGuard)
export class IncidentsController {
  constructor(private readonly cases: CasesService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentActor() actor: StaffActor, @Body(new ZodValidationPipe(createIncidentSchema)) input: CreateIncidentInput): Promise<Incident> {
    return this.cases.createIncident(actor, input);
  }

  @Get()
  list(@Query('status', new ZodValidationPipe(statusFilterSchema)) status: IncidentStatus | undefined): Promise<Incident[]> {
    return this.cases.listIncidents(status);
  }

  /** Marks the incident resolved; linked cases keep their own status (§5.4). */
  @Post(':id/resolve')
  @HttpCode(200)
  resolve(@CurrentActor() actor: StaffActor, @Param('id', ParseUUIDPipe) id: string): Promise<Incident> {
    return this.cases.resolveIncident(actor, id);
  }

  /** One internal note to every linked open case. */
  @Post(':id/notes')
  @HttpCode(200)
  broadcast(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(incidentNoteSchema)) input: IncidentNoteInput,
  ): Promise<{ delivered: number }> {
    return this.cases.broadcastIncidentNote(actor, id, input);
  }
}
