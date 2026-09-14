import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { jobDisabled, positiveNumberEnv } from '../common/env.js';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { supportCases } from '../database/schema.js';
import { CasesService } from './cases.service.js';
import { SettingsService } from './settings.service.js';

/**
 * Reminders for cases waiting on the customer (PH-6.3, context §7.4): one `reminder` notification per waiting
 * period after `reminderAfterHours`, recorded as an attributable `reminder_sent` event. Silence is never treated
 * as a solution — the case stays `waiting_customer`. The job only finds candidates; `CasesService.remind`
 * decides on the locked row (DEC-0017, BL-022). Single instance (DEC-0033).
 */
@Injectable()
export class ReminderJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderJob.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly settings: SettingsService,
    private readonly cases: CasesService,
  ) {}

  onModuleInit(): void {
    if (jobDisabled('SUPPORT_REMINDER_JOB')) return;
    this.timer = setInterval(() => void this.tick(), positiveNumberEnv('SUPPORT_REMINDER_INTERVAL_MS', 60_000));
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.remindDue();
      if (sent > 0) this.logger.log(`Sent ${sent} reminder(s) to customers`);
    } catch (error) {
      this.logger.error('Reminder job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  /** Reminds every `waiting_customer` case whose wait is older than the delay and has no reminder yet. */
  async remindDue(now = new Date()): Promise<number> {
    const hours = (await this.settings.get()).reminderAfterHours;
    const cutoff = new Date(now.getTime() - hours * 3_600_000);
    // The wait starts when the case enters `waiting_customer` (or staff write while it waits) — never at an
    // older staff reply, which fired reminders the moment the status was set (FND-0033).
    const due = await this.db
      .select({ id: supportCases.id })
      .from(supportCases)
      .where(and(eq(supportCases.status, 'waiting_customer'), isNull(supportCases.reminderSentAt), isNotNull(supportCases.waitingCustomerSince), lt(supportCases.waitingCustomerSince, cutoff)))
      .limit(200);
    let sent = 0;
    for (const row of due) {
      try {
        if (await this.cases.remind(row.id, cutoff, hours, now)) sent += 1;
      } catch (error) {
        // One failing row must not silence every later reminder in the batch (FND-0045).
        this.logger.error(`Reminder for case ${row.id} failed`, error instanceof Error ? error.stack : String(error));
      }
    }
    return sent;
  }
}
