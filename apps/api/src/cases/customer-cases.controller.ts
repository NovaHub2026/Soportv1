import { Body, Controller, Get, HttpCode, type MessageEvent, Param, ParseUUIDPipe, Post, Sse, UseGuards } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { CaseStreamService } from '../events/case-stream.service.js';
import {
  type CaseMessage,
  type CaseSummary,
  createCaseSchema,
  type CreateCaseInput,
  type CustomerCaseDetail,
  postMessageSchema,
  type PostMessageInput,
} from '@orbit-support/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentActor, CustomerGuard } from '../identity/guards.js';
import type { CustomerActor } from '../identity/identity.types.js';
import { CasesService } from './cases.service.js';

/** Customer surface: a signed-in Orbit customer and only their own cases (RULE-SUP-01). */
@Controller('support/cases')
@UseGuards(CustomerGuard)
export class CustomerCasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly streams: CaseStreamService,
  ) {}

  /** Live events for one own case (ADR-0004). Ownership is checked before any byte is streamed. */
  @Sse(':id/stream')
  async stream(@CurrentActor() actor: CustomerActor, @Param('id', ParseUUIDPipe) id: string): Promise<Observable<MessageEvent>> {
    await this.cases.getCustomerCase(actor, id);
    return this.streams.customerCaseStream(actor.id, id);
  }

  /** Sending the first request creates the case (context §4.1); opening the panel never does. */
  @Post()
  create(
    @CurrentActor() actor: CustomerActor,
    @Body(new ZodValidationPipe(createCaseSchema)) input: CreateCaseInput,
  ): Promise<CustomerCaseDetail> {
    return this.cases.createCase(actor, input);
  }

  @Get()
  list(@CurrentActor() actor: CustomerActor): Promise<CaseSummary[]> {
    return this.cases.listCustomerCases(actor);
  }

  @Get(':id')
  get(@CurrentActor() actor: CustomerActor, @Param('id', ParseUUIDPipe) id: string): Promise<CustomerCaseDetail> {
    return this.cases.getCustomerCase(actor, id);
  }

  @Post(':id/messages')
  @HttpCode(201)
  postMessage(
    @CurrentActor() actor: CustomerActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(postMessageSchema)) input: PostMessageInput,
  ): Promise<CaseMessage> {
    return this.cases.postCustomerMessage(actor, id, input);
  }
}
