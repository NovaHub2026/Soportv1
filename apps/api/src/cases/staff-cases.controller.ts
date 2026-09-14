import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
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
  answerConsultationSchema,
  type AnswerConsultationInput,
  assignCaseSchema,
  type AssignCaseInput,
  type CaseAttachment,
  type CaseConsultation,
  type CaseMessage,
  type CaseSummary,
  linkIncidentSchema,
  type LinkIncidentInput,
  type OrbitCaseContext,
  postMessageSchema,
  type PostMessageInput,
  postNoteSchema,
  type PostNoteInput,
  requestConsultationSchema,
  type RequestConsultationInput,
  resolveCaseSchema,
  type ResolveCaseInput,
  setStatusSchema,
  type SetStatusInput,
  type StaffCaseDetail,
  type StaffListQuery,
  staffListQuerySchema,
  updateCaseSchema,
  type UpdateCaseInput,
} from '@orbit-support/shared';
import { sendAttachment, UPLOAD_OPTIONS } from '../attachments/attachments.controller-support.js';
import { AttachmentsService, type UploadedFileLike } from '../attachments/attachments.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CaseStreamService } from '../events/case-stream.service.js';
import { CurrentActor, StaffGuard } from '../identity/guards.js';
import type { StaffActor } from '../identity/identity.types.js';
import { ORBIT_RECORDS, type OrbitRecordsPort } from '../identity/orbit-records.js';
import { CasesService } from './cases.service.js';


/** Staff surface: queues, full conversation (including internal notes), take and reply. */
@Controller('staff/cases')
@UseGuards(StaffGuard)
export class StaffCasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly streams: CaseStreamService,
    private readonly attachments: AttachmentsService,
    @Inject(ORBIT_RECORDS) private readonly orbit: OrbitRecordsPort,
  ) {}

  /**
   * Orbit context for the case's customer (PH-4.1, context §6.1): a separate read so an adapter failure never
   * delays or breaks the conversation; each lookup is available or explicitly unavailable (RULE-SUP-07).
   */
  @Get(':id/orbit')
  async orbitContext(@Param('id', ParseUUIDPipe) id: string): Promise<OrbitCaseContext> {
    const row = await this.cases.requireCaseRow(id);
    const [customer, record] = await Promise.all([this.orbit.customerSummary(row.customerId), this.cases.currentRecord(row)]);
    return { customer, record };
  }

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
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
  stream(@CurrentActor() actor: StaffActor): Observable<MessageEvent> {
    return this.streams.staffStream(actor.id);
  }

  @Get()
  list(@CurrentActor() actor: StaffActor, @Query(new ZodValidationPipe(staffListQuerySchema)) query: StaffListQuery): Promise<CaseSummary[]> {
    const { view, limit, offset, ...filters } = query;
    return this.cases.listStaffCases(actor, view, { limit, offset }, filters);
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

  /** Transfer or release (PH-3.3): owner, unowned case, or supervisor/admin. */
  @Post(':id/assign')
  @HttpCode(200)
  assign(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(assignCaseSchema)) input: AssignCaseInput,
  ): Promise<CaseSummary> {
    return this.cases.assignCase(actor, id, input);
  }

  /** Priority / category corrections with history (PH-3.3). */
  @Patch(':id')
  update(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCaseSchema)) input: UpdateCaseInput,
  ): Promise<CaseSummary> {
    return this.cases.updateAttributes(actor, id, input);
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

  /** Associate with / detach from a shared incident (PH-3.5). */
  @Post(':id/incident')
  @HttpCode(200)
  linkIncident(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(linkIncidentSchema)) input: LinkIncidentInput,
  ): Promise<CaseSummary> {
    return this.cases.linkIncident(actor, id, input.incidentId);
  }

  /** Close a resolved case explicitly (PH-3.4); the follow-up window job does the same automatically. */
  @Post(':id/close')
  @HttpCode(200)
  close(@CurrentActor() actor: StaffActor, @Param('id', ParseUUIDPipe) id: string): Promise<CaseSummary> {
    return this.cases.closeCase(actor, id);
  }

  /** Internal note: staff-only message (RULE-SUP-04). */
  @Post(':id/notes')
  @HttpCode(201)
  postNote(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(postNoteSchema)) input: PostNoteInput,
  ): Promise<CaseMessage> {
    return this.cases.postInternalNote(actor, id, input);
  }

  /** Refer a question to another team; the case waits for the internal team (context §5.3). */
  @Post(':id/consultations')
  @HttpCode(201)
  requestConsultation(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(requestConsultationSchema)) input: RequestConsultationInput,
  ): Promise<CaseConsultation> {
    return this.cases.requestConsultation(actor, id, input);
  }

  @Post(':id/consultations/:consultationId/answer')
  @HttpCode(200)
  answerConsultation(
    @CurrentActor() actor: StaffActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Body(new ZodValidationPipe(answerConsultationSchema)) input: AnswerConsultationInput,
  ): Promise<CaseConsultation> {
    return this.cases.answerConsultation(actor, id, consultationId, input);
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
