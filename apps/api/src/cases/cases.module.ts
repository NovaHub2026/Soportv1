import { Module } from '@nestjs/common';
import { CasesService } from './cases.service.js';
import { ClosureJob } from './closure.job.js';
import { CustomerCasesController } from './customer-cases.controller.js';
import { CustomerRecordsController } from './customer-records.controller.js';
import { IncidentsController } from './incidents.controller.js';
import { StaffCasesController } from './staff-cases.controller.js';

@Module({
  controllers: [CustomerCasesController, CustomerRecordsController, StaffCasesController, IncidentsController],
  providers: [CasesService, ClosureJob],
  exports: [CasesService],
})
export class CasesModule {}
