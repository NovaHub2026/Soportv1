import {
  Body,
  Controller,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  type CaseSummary,
  postMessageSchema,
  type PostMessageInput,
  resolveCaseSchema,
  type ResolveCaseInput,
  setStatusSchema,
  type SetStatusInput,
  type StaffCaseDetail,
  type StaffQueueView,
  staffQueueViewSchema,
} from '@orbit-support/shared';
import { sendAttachment, UPLOAD_LIMITS } from '../attachments/attachments.controller-support.js';
import { AttachmentsService, type UploadedFileLike } from '../attachments/attachments.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CaseStreamService } from '../events/case-stream.service.js';
import { CurrentActor, StaffGuard } from '../identity/guards.js';
import type { StaffActor } from '../identity/identity.types.js';
import { CasesService } from './cases.service.js';

const viewSchema = staffQueueViewSchema.default('unassigned');

/** Staff surface: queues, full conversation (including internal notes), take and reply. */
@Controller('staff/cases')
@UseGuards(StaffGuard)
export class StaffCasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly streams: CaseStreamService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: UPLOAD_LIMITS }))
  async upload(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedFileLike,
  ): Promise<CaseAttachment> {
    const row = await this.cases.requireCaseRow(id);
    return this.attachments.upload(actor, row, file);
  }

  @Get(':id/attachments/:attachmentId')
  async download(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const row = await this.cases.requireCaseRow(id);
    sendAttachment(response, await this.attachments.open(actor, row, attachmentId));
  }

  /** `GET /api/staff/cases/stream` — every case change, including internal notes; staff only (ADR-0004). Declared before `:id`. */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.streams.staffStream();
  }

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

  /** What the case is waiting for (PH-3.1): in_progress | waiting_customer | waiting_internal. */
  @Post(':id/status')
  @HttpCode(200)
  setStatus(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setStatusSchema)) input: SetStatusInput,
  ): Promise<CaseSummary> {
    return this.cases.setStatus(actor, id, input.status);
  }

  /** Conclude with a reason and a customer-facing explanation (§7.1). */
  @Post(':id/resolve')
  @HttpCode(200)
  resolve(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(resolveCaseSchema)) input: ResolveCaseInput,
  ): Promise<CaseSummary> {
    return this.cases.resolve(actor, id, input);
  }

  /** Staff have the conversation open: customer messages received so far count as read. */
  @Post(':id/read')
  @HttpCode(200)
  markRead(@Param('id', ParseUUIDPipe) id: string): Promise<CaseSummary> {
    return this.cases.markStaffRead(id);
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
