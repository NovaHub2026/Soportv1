import { Module } from '@nestjs/common';
import { CasesService } from './cases.service.js';
import { ClosureJob } from './closure.job.js';
import { CustomerCasesController } from './customer-cases.controller.js';
import { CustomerRecordsController } from './customer-records.controller.js';
import { IncidentsController } from './incidents.controller.js';
import { SavedRepliesController } from './saved-replies.controller.js';
import { EMAIL_NOTIFIER, SimulatedEmailNotifier } from './email-notifier.js';
import { NotificationJob } from './notification.job.js';
import { NotificationsController } from './notifications.controller.js';
import { PreferencesController } from './preferences.controller.js';
import { ReminderJob } from './reminder.job.js';
import { NotificationsService } from './notifications.service.js';
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
    NotificationsController,
    PreferencesController,
    StaffCasesController,
    IncidentsController,
    SavedRepliesController,
    SettingsController,
    SupervisionController,
  ],
  providers: [
    CasesService,
    ClosureJob,
    SavedRepliesService,
    SettingsService,
    SupervisionService,
    NotificationsService,
    NotificationJob,
    ReminderJob,
    { provide: EMAIL_NOTIFIER, useClass: SimulatedEmailNotifier },
  ],
  exports: [CasesService, NotificationsService],
})
export class CasesModule {}
