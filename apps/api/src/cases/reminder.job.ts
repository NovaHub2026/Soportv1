import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { jobDisabled, positiveNumberEnv } from '../common/env.js';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { caseEvents, supportCases } from '../database/schema.js';
import { NotificationsService } from './notifications.service.js';
import { SettingsService } from './settings.service.js';

/**
 * Reminders for cases waiting on the customer (PH-6.3, context §7.4): one `reminder` notification per waiting
 * period after `reminderAfterHours`, recorded as an attributable `reminder_sent` event. Silence is never treated
 * as a solution — the case stays `waiting_customer`. Single instance until PH-8.
 */
@Injectable()
export class ReminderJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderJob.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
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
      .select()
      .from(supportCases)
      .where(and(eq(supportCases.status, 'waiting_customer'), isNull(supportCases.reminderSentAt), isNotNull(supportCases.waitingCustomerSince), lt(supportCases.waitingCustomerSince, cutoff)))
      .limit(200);
    let sent = 0;
    for (const row of due) {
      try {
        await this.db.transaction(async (tx) => {
          const [locked] = await tx.select().from(supportCases).where(eq(supportCases.id, row.id)).limit(1).for('update');
          if (!locked || locked.status !== 'waiting_customer' || locked.reminderSentAt || !locked.waitingCustomerSince || locked.waitingCustomerSince >= cutoff) return;
          await tx.insert(caseEvents).values({ caseId: locked.id, type: 'reminder_sent', actorType: 'system', actorId: 'reminder-job', data: { afterHours: hours }, createdAt: now });
          await tx.update(supportCases).set({ reminderSentAt: now }).where(eq(supportCases.id, locked.id));
          await this.notifications.record(tx, locked.customerId, locked.id, 'reminder', now);
          sent += 1;
        });
      } catch (error) {
        // One failing row must not silence every later reminder in the batch (FND-0045).
        this.logger.error(`Reminder for case ${row.id} failed`, error instanceof Error ? error.stack : String(error));
      }
    }
    return sent;
  }
}
