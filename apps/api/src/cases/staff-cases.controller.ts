import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  type CaseMessage,
  type CaseSummary,
  postMessageSchema,
  type PostMessageInput,
  type StaffCaseDetail,
  type StaffQueueView,
  staffQueueViewSchema,
} from '@orbit-support/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentActor, StaffGuard } from '../identity/guards.js';
import type { StaffActor } from '../identity/identity.types.js';
import { CasesService } from './cases.service.js';

const viewSchema = staffQueueViewSchema.default('unassigned');

/** Staff surface: queues, full conversation (including internal notes), take and reply. */
@Controller('staff/cases')
@UseGuards(StaffGuard)
export class StaffCasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  list(
    @CurrentActor() actor: StaffActor,
    @Query('view', new ZodValidationPipe(viewSchema)) view: StaffQueueView,
  ): Promise<CaseSummary[]> {
    return this.cases.listStaffCases(actor, view);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<StaffCaseDetail> {
    return this.cases.getStaffCase(id);
  }

  @Post(':id/take')
  @HttpCode(200)
  take(@CurrentActor() actor: StaffActor, @Param('id', ParseUUIDPipe) id: string): Promise<CaseSummary> {
    return this.cases.takeCase(actor, id);
  }

  @Post(':id/messages')
  @HttpCode(201)
  postMessage(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(postMessageSchema)) input: PostMessageInput,
  ): Promise<CaseMessage> {
    return this.cases.postStaffMessage(actor, id, input);
  }
}
