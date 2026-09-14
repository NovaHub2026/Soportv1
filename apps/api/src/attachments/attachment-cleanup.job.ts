import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { jobDisabled, positiveNumberEnv } from '../common/env.js';
import { AttachmentsService } from './attachments.service.js';

/**
 * Removes uploads never linked to a message after a grace period (BL-009): case uploads their sender abandoned and
 * staged uploads that never opened a case (DEC-0037). Hourly by default (`SUPPORT_ATTACHMENT_CLEANUP_INTERVAL_MS`);
 * `SUPPORT_UNLINKED_ATTACHMENT_GRACE_HOURS` (default 24) is how long an upload may wait for its message;
 * `SUPPORT_ATTACHMENT_CLEANUP_JOB=off` disables it. Single instance (DEC-0033).
 */
@Injectable()
export class AttachmentCleanupJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttachmentCleanupJob.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly attachments: AttachmentsService) {}

  onModuleInit(): void {
    if (jobDisabled('SUPPORT_ATTACHMENT_CLEANUP_JOB')) return;
    this.timer = setInterval(() => void this.tick(), positiveNumberEnv('SUPPORT_ATTACHMENT_CLEANUP_INTERVAL_MS', 3_600_000));
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const removed = await this.attachments.removeUnlinked(new Date(), positiveNumberEnv('SUPPORT_UNLINKED_ATTACHMENT_GRACE_HOURS', 24));
      if (removed > 0) this.logger.log(`Removed ${removed} upload(s) never linked to a message`);
    } catch (error) {
      this.logger.error('Attachment cleanup failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
