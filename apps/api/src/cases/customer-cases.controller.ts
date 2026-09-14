import {
  Body,
  Controller,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import {
  type CaseAttachment,
  type CaseMessage,
  createCaseSchema,
  type CreateCaseInput,
  type CustomerCaseDetail,
  type CustomerCaseSummary,
  followUpSchema,
  type FollowUpInput,
  postMessageSchema,
  type PostMessageInput,
} from '@orbit-support/shared';
import { sendAttachment, UPLOAD_OPTIONS } from '../attachments/attachments.controller-support.js';
import { AttachmentsService, type UploadedFileLike } from '../attachments/attachments.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CaseStreamService } from '../events/case-stream.service.js';
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
    private readonly attachments: AttachmentsService,
  ) {}

  /** Upload one file to an own case; it is linked to a message when that message is sent (PH-2.3). */
  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  async upload(
    @CurrentActor() actor: CustomerActor,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedFileLike,
  ): Promise<CaseAttachment> {
    const row = await this.cases.requireOwnCaseRow(actor, id);
    return this.attachments.upload(actor, row, file);
  }

  /** Bytes of an attachment on an own case (own upload or on a public message), or 404. */
  @Get(':id/attachments/:attachmentId')
  async download(
    @CurrentActor() actor: CustomerActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const row = await this.cases.requireOwnCaseRow(actor, id);
    sendAttachment(response, await this.attachments.open(actor, row, attachmentId));
  }

  /** `GET /api/support/cases/stream` — live events for all own cases (home lists, unread badges). Declared before `:id`. */
  @Sse('stream')
  streamAll(@CurrentActor() actor: CustomerActor): Observable<MessageEvent> {
    return this.streams.customerStream(actor.id);
  }

  /** Live events for one own case (ADR-0004). Ownership is checked before any byte is streamed. */
  @Sse(':id/stream')
  async stream(@CurrentActor() actor: CustomerActor, @Param('id', ParseUUIDPipe) id: string): Promise<Observable<MessageEvent>> {
    await this.cases.getCustomerCase(actor, id);
    return this.streams.customerCaseStream(actor.id, id);
  }

  /** "Preciso de mais ajuda" from a closed case: a new linked case (§7.3). */
  @Post(':id/follow-up')
  followUp(
    @CurrentActor() actor: CustomerActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(followUpSchema)) input: FollowUpInput,
  ): Promise<CustomerCaseDetail> {
    return this.cases.createFollowUp(actor, id, input);
  }

  /** The customer has the conversation in front of them: mark everything received as read. */
  @Post(':id/read')
  @HttpCode(200)
  markRead(@CurrentActor() actor: CustomerActor, @Param('id', ParseUUIDPipe) id: string): Promise<CustomerCaseSummary> {
    return this.cases.markCustomerRead(actor, id);
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
  list(@CurrentActor() actor: CustomerActor): Promise<CustomerCaseSummary[]> {
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

/** Files a customer attaches before the case exists (PH-9.3, BL-010): linked to its first message when the case is created. */
@Controller('support/attachments')
@UseGuards(CustomerGuard)
export class CustomerStagedAttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  upload(@CurrentActor() actor: CustomerActor, @UploadedFile() file?: UploadedFileLike): Promise<CaseAttachment> {
    return this.attachments.uploadStaged(actor, file);
  }
}
