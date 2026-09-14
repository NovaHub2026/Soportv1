import { Module } from '@nestjs/common';
import { CasesService } from './cases.service.js';
import { CustomerCasesController } from './customer-cases.controller.js';
import { StaffCasesController } from './staff-cases.controller.js';

@Module({
  controllers: [CustomerCasesController, StaffCasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
