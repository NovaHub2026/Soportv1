import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { type CustomerDataExport, type DataExportRecord, type DataExportRequestInput, dataExportRequestSchema } from '@orbit-support/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentActor, StaffGuard } from '../identity/guards.js';
import type { StaffActor } from '../identity/identity.types.js';
import { DataExportService } from './data-export.service.js';

/** Exports of a customer's support data (PH-10.3, DEC-0039 h): administrators only; every export is recorded. */
@Controller('staff/customers')
@UseGuards(StaffGuard)
export class DataExportController {
  constructor(private readonly exports: DataExportService) {}

  @Post(':customerId/export')
  @HttpCode(201)
  exportCustomer(
    @CurrentActor() actor: StaffActor,
    @Param('customerId') customerId: string,
    @Body(new ZodValidationPipe(dataExportRequestSchema)) input: DataExportRequestInput,
  ): Promise<CustomerDataExport> {
    return this.exports.exportCustomer(actor, customerId, input);
  }
}

/** The record of exports made (PH-10.3): administrators only. */
@Controller('staff/data-exports')
@UseGuards(StaffGuard)
export class DataExportsController {
  constructor(private readonly exports: DataExportService) {}

  @Get()
  list(@CurrentActor() actor: StaffActor): Promise<DataExportRecord[]> {
    return this.exports.list(actor);
  }
}
