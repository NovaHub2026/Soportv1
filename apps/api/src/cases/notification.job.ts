import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';
import { type CustomerPreferences, type EmailNotification, formatCaseReference, maskEmail, type NotificationKind } from '@orbit-support/shared';
import { jobDisabled, positiveNumberEnv } from '../common/env.js';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { caseNotifications, customerPreferences, type EmailOutboxRow, emailOutbox, supportCases } from '../database/schema.js';
import type { CustomerActor } from '../identity/identity.types.js';
import { ORBIT_RECORDS, type OrbitRecordsPort } from '../identity/orbit-records.js';
import { EMAIL_NOTIFIER, type EmailNotifierPort } from './email-notifier.js';
import { SettingsService } from './settings.service.js';

/** Customer-facing copy of the e-mails (pt-BR first, context §10.1). Never includes message content. */
const SUBJECTS: Record<NotificationKind, (reference: string) => string> = {
  staff_reply: (r) => `Nova resposta no seu caso ${r}`,
  waiting_customer: (r) => `Precisamos da sua resposta no caso ${r}`,
  resolved: (r) => `Seu caso ${r} foi marcado como resolvido`,
  closed: (r) => `Seu caso ${r} foi encerrado`,
  reminder: (r) => `Lembrete: seu caso ${r} aguarda sua resposta`,
  outside_hours: (r) => `Recebemos sua mensagem no caso ${r}`,
};

/**
 * E-mails unread notifications after the configured delay (PH-6.2, context §4.4): once per notification,
 * only for customers who did not opt out and whose address the boundary knows. Runs in the API process
 * (single instance until PH-8); `SUPPORT_NOTIFICATION_JOB=off` disables it, `SUPPORT_NOTIFICATION_INTERVAL_MS` sets the cadence.
 * A send that keeps failing is retried up to `SUPPORT_EMAIL_MAX_ATTEMPTS` times (5) and then parked as a dead letter
 * with an error in the log (BL-028): the in-product notification stays, the e-mail is given up on.
 */
export const DEFAULT_EMAIL_MAX_ATTEMPTS = 5;
@Injectable()
export class NotificationJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationJob.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(EMAIL_NOTIFIER) private readonly notifier: EmailNotifierPort,
    @Inject(ORBIT_RECORDS) private readonly orbit: OrbitRecordsPort,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    if (jobDisabled('SUPPORT_NOTIFICATION_JOB')) return;
    this.timer = setInterval(() => void this.tick(), positiveNumberEnv('SUPPORT_NOTIFICATION_INTERVAL_MS', 60_000));
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.emailDue();
      if (sent > 0) this.logger.log(`E-mailed ${sent} notification(s) (simulated delivery)`);
    } catch (error) {
      this.logger.error('Notification job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  /** E-mails every unread, not-yet-e-mailed notification older than the delay. Returns how many were sent. */
  async emailDue(now = new Date()): Promise<number> {
    const delayMinutes = (await this.settings.get()).emailDelayMinutes;
    const cutoff = new Date(now.getTime() - delayMinutes * 60_000);
    const due = await this.db
      .select({ n: caseNotifications, referenceNumber: supportCases.referenceNumber })
      .from(caseNotifications)
      .innerJoin(supportCases, eq(supportCases.id, caseNotifications.caseId))
      .where(and(isNull(caseNotifications.readAt), isNull(caseNotifications.emailedAt), isNull(caseNotifications.emailFailedAt), lt(caseNotifications.createdAt, cutoff)))
      .orderBy(asc(caseNotifications.createdAt))
      .limit(200);
    let sent = 0;
    for (const { n, referenceNumber } of due) {
      const preferences = await this.preferences({ kind: 'customer', id: n.customerId, source: 'simulated' });
      let address: string | null = null;
      if (preferences.emailNotifications) {
        const lookup = await this.orbit.contactEmail(n.customerId);
        if (lookup.state === 'unavailable') {
          // "Could not ask" is not "no address": leave the row unmarked and retry the batch next tick (FND-0032).
          this.logger.warn(`Orbit contact lookup unavailable (${lookup.reason}); e-mails wait for the next tick`);
          break;
        }
        address = lookup.data;
      }
      // Claim before sending so a second instance (PH-8) or an overlapping tick never sends the same e-mail twice;
      // a failed send releases the claim for the next tick (FND-0045).
      const claimed = await this.db
        .update(caseNotifications)
        .set({ emailedAt: now })
        .where(and(eq(caseNotifications.id, n.id), isNull(caseNotifications.emailedAt)))
        .returning({ id: caseNotifications.id });
      if (claimed.length === 0) continue;
      if (!address) continue; // opted out or no address: marked, not retried every tick
      const reference = formatCaseReference(referenceNumber);
      const link = `/?case=${n.caseId}`;
      try {
        await this.notifier.send({
          to: address,
          subject: SUBJECTS[n.kind as NotificationKind](reference),
          body: `Há uma atualização no seu caso ${reference}. Abra a conversa no Orbit para ver os detalhes: ${link}\n\nPor segurança, este e-mail não contém o conteúdo da conversa.`,
          context: { customerId: n.customerId, caseId: n.caseId, notificationId: n.id, kind: n.kind as NotificationKind, caseReference: reference, link, toMasked: maskEmail(address) },
        });
        sent += 1;
      } catch (error) {
        // Released for the next tick; after the last allowed attempt the row is a dead letter (BL-028).
        const attempts = n.emailAttempts + 1;
        const dead = attempts >= positiveNumberEnv('SUPPORT_EMAIL_MAX_ATTEMPTS', DEFAULT_EMAIL_MAX_ATTEMPTS);
        await this.db
          .update(caseNotifications)
          .set({ emailedAt: null, emailAttempts: sql`${caseNotifications.emailAttempts} + 1`, ...(dead ? { emailFailedAt: now } : {}) })
          .where(eq(caseNotifications.id, n.id));
        this.logger.error(
          dead ? `E-mail for notification ${n.id} failed ${attempts} times; parked as a dead letter (the in-product notification stays)` : `E-mail for notification ${n.id} failed (attempt ${attempts}); released for retry`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return sent;
  }

  async preferences(customer: CustomerActor): Promise<CustomerPreferences> {
    const [row] = await this.db.select().from(customerPreferences).where(eq(customerPreferences.customerId, customer.id)).limit(1);
    return { emailNotifications: row ? row.emailNotifications : true, updatedAt: row ? row.updatedAt.toISOString() : null };
  }

  async updatePreferences(customer: CustomerActor, input: { emailNotifications: boolean }): Promise<CustomerPreferences> {
    const now = new Date();
    const [row] = await this.db
      .insert(customerPreferences)
      .values({ customerId: customer.id, emailNotifications: input.emailNotifications, updatedAt: now })
      .onConflictDoUpdate({ target: customerPreferences.customerId, set: { emailNotifications: input.emailNotifications, updatedAt: now } })
      .returning();
    return { emailNotifications: row.emailNotifications, updatedAt: row.updatedAt.toISOString() };
  }

  /** The customer's own simulated outbox (labeled evidence surface). */
  async outbox(customer: CustomerActor, limit = 20): Promise<EmailNotification[]> {
    const rows = await this.db.select().from(emailOutbox).where(eq(emailOutbox.customerId, customer.id)).orderBy(asc(emailOutbox.createdAt)).limit(limit);
    return rows.reverse().map(toEmailNotification);
  }
}

function toEmailNotification(row: EmailOutboxRow): EmailNotification {
  return {
    id: row.id,
    caseId: row.caseId,
    kind: row.kind as NotificationKind,
    toMasked: row.toMasked,
    subject: row.subject,
    link: row.link,
    delivery: 'simulated',
    createdAt: row.createdAt.toISOString(),
  };
}
