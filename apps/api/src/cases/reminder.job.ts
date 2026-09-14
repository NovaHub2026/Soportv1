import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { positiveNumberEnv } from '../common/env.js';
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
    if (process.env.SUPPORT_REMINDER_JOB === 'off') return;
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
    // The wait started at the latest staff reply, or at the status change when no reply followed it.
    const waitingSince = sql`coalesce(${supportCases.lastStaffMessageAt}, ${supportCases.updatedAt})`;
    const due = await this.db
      .select()
      .from(supportCases)
      .where(and(eq(supportCases.status, 'waiting_customer'), isNull(supportCases.reminderSentAt), or(lt(waitingSince, cutoff), sql`false`)))
      .limit(200);
    let sent = 0;
    for (const row of due) {
      await this.db.transaction(async (tx) => {
        const [locked] = await tx.select().from(supportCases).where(eq(supportCases.id, row.id)).limit(1).for('update');
        if (!locked || locked.status !== 'waiting_customer' || locked.reminderSentAt) return;
        await tx.insert(caseEvents).values({ caseId: locked.id, type: 'reminder_sent', actorType: 'system', actorId: 'reminder-job', data: { afterHours: hours }, createdAt: now });
        await tx.update(supportCases).set({ reminderSentAt: now }).where(eq(supportCases.id, locked.id));
        await this.notifications.record(tx, locked.customerId, locked.id, 'reminder', now);
        sent += 1;
      });
    }
    return sent;
  }
}
