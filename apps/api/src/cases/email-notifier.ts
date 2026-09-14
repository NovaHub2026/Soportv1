import { Inject, Injectable } from '@nestjs/common';
import type { NotificationKind } from '@orbit-support/shared';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { emailOutbox } from '../database/schema.js';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  /** Context the simulated adapter records for the labeled outbox; a real adapter ignores it. */
  context: { customerId: string; caseId: string; notificationId: string; kind: NotificationKind; caseReference: string; link: string; toMasked: string };
}

/**
 * The outbound e-mail boundary (PH-6.2). No provider exists (BL-002); the only adapter is a simulation that
 * records what would have been sent. A real adapter (PH-8) implements `send` and nothing else changes.
 */
export interface EmailNotifierPort {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL_NOTIFIER = Symbol('EMAIL_NOTIFIER');

/** SIMULATED delivery: the message is stored in `email_outbox` (raw address never stored — only the masked one). */
@Injectable()
export class SimulatedEmailNotifier implements EmailNotifierPort {
  constructor(@Inject(DB) private readonly db: Db) {}

  async send(message: EmailMessage): Promise<void> {
    const { context } = message;
    await this.db.insert(emailOutbox).values({
      customerId: context.customerId,
      caseId: context.caseId,
      notificationId: context.notificationId,
      kind: context.kind,
      toMasked: context.toMasked,
      subject: message.subject,
      body: message.body,
      link: context.link,
      delivery: 'simulated',
    });
  }
}
