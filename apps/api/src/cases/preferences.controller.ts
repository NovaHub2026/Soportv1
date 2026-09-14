import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { type CustomerPreferences, customerPreferencesInputSchema, type CustomerPreferencesInput, type EmailNotification } from '@orbit-support/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentActor, CustomerGuard } from '../identity/guards.js';
import type { CustomerActor } from '../identity/identity.types.js';
import { NotificationJob } from './notification.job.js';

/** Customer preferences and the labeled simulated outbox (PH-6.2). Own rows only. */
@Controller('support')
@UseGuards(CustomerGuard)
export class PreferencesController {
  constructor(private readonly job: NotificationJob) {}

  @Get('preferences')
  preferences(@CurrentActor() actor: CustomerActor): Promise<CustomerPreferences> {
    return this.job.preferences(actor);
  }

  @Put('preferences')
  update(@CurrentActor() actor: CustomerActor, @Body(new ZodValidationPipe(customerPreferencesInputSchema)) input: CustomerPreferencesInput): Promise<CustomerPreferences> {
    return this.job.updatePreferences(actor, input);
  }

  /** What the simulated notifier would have sent to this customer — evidence surface, labeled in the UI. */
  @Get('emails')
  async emails(@CurrentActor() actor: CustomerActor): Promise<{ emails: EmailNotification[]; delivery: 'simulated' }> {
    return { emails: await this.job.outbox(actor), delivery: 'simulated' };
  }
}
