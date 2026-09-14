import { Module } from '@nestjs/common';
import { CasesService } from './cases.service.js';
import { ClosureJob } from './closure.job.js';
import { CustomerCasesController } from './customer-cases.controller.js';
import { StaffCasesController } from './staff-cases.controller.js';

@Module({
  controllers: [CustomerCasesController, StaffCasesController],
  providers: [CasesService, ClosureJob],
  exports: [CasesService],
})
export class CasesModule {}
