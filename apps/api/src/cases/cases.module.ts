import { Module } from '@nestjs/common';
import { CasesService } from './cases.service.js';
import { ClosureJob } from './closure.job.js';
import { CustomerCasesController } from './customer-cases.controller.js';
import { CustomerRecordsController } from './customer-records.controller.js';
import { IncidentsController } from './incidents.controller.js';
import { SavedRepliesController } from './saved-replies.controller.js';
import { SavedRepliesService } from './saved-replies.service.js';
import { SettingsService } from './settings.service.js';
import { AvailabilityController, SettingsController, SupervisionController } from './supervision.controller.js';
import { SupervisionService } from './supervision.service.js';
import { StaffCasesController } from './staff-cases.controller.js';

@Module({
  controllers: [
    CustomerCasesController,
    CustomerRecordsController,
    AvailabilityController,
    StaffCasesController,
    IncidentsController,
    SavedRepliesController,
    SettingsController,
    SupervisionController,
  ],
  providers: [CasesService, ClosureJob, SavedRepliesService, SettingsService, SupervisionService],
  exports: [CasesService],
})
export class CasesModule {}
