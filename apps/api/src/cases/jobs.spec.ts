import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../database/database.js';
import type { CasesService } from './cases.service.js';
import { AttachmentCleanupJob } from '../attachments/attachment-cleanup.job.js';
import type { AttachmentsService } from '../attachments/attachments.service.js';
import { ClosureJob } from './closure.job.js';
import type { EmailNotifierPort } from './email-notifier.js';
import { NotificationJob } from './notification.job.js';
import { ReminderJob } from './reminder.job.js';
import type { SettingsService } from './settings.service.js';
import type { OrbitRecordsPort } from '../identity/orbit-records.js';

/**
 * The background jobs' `tick()` paths (BL-022, Cycle Audit 2 FND-0051): single flight, failures logged without
 * stopping the next tick, the interval started only when enabled and cleared on shutdown. The work each tick runs
 * is covered against the database in `cases.service.spec.ts`; here it is replaced by a controllable stub.
 */
type Work = () => Promise<number>;
interface JobCase {
  name: string;
  envSwitch: string;
  envInterval: string;
  make: (work: Work) => { onModuleInit(): void; onModuleDestroy(): void; tick(): Promise<void> };
}

const nothing = {} as never;
const JOBS: JobCase[] = [
  {
    name: 'ClosureJob',
    envSwitch: 'SUPPORT_CLOSURE_JOB',
    envInterval: 'SUPPORT_CLOSURE_INTERVAL_MS',
    make: (work) =>
      new ClosureJob({ closeExpired: () => work() } as unknown as CasesService, { followUpWindowDays: async () => 7 } as unknown as SettingsService),
  },
  {
    name: 'ReminderJob',
    envSwitch: 'SUPPORT_REMINDER_JOB',
    envInterval: 'SUPPORT_REMINDER_INTERVAL_MS',
    make: (work) => {
      const job = new ReminderJob(nothing as Db, nothing as SettingsService, nothing as CasesService);
      vi.spyOn(job, 'remindDue').mockImplementation(work);
      return job;
    },
  },
  {
    name: 'NotificationJob',
    envSwitch: 'SUPPORT_NOTIFICATION_JOB',
    envInterval: 'SUPPORT_NOTIFICATION_INTERVAL_MS',
    make: (work) => {
      const job = new NotificationJob(nothing as Db, nothing as EmailNotifierPort, nothing as OrbitRecordsPort, nothing as SettingsService);
      vi.spyOn(job, 'emailDue').mockImplementation(work);
      return job;
    },
  },
  {
    name: 'AttachmentCleanupJob',
    envSwitch: 'SUPPORT_ATTACHMENT_CLEANUP_JOB',
    envInterval: 'SUPPORT_ATTACHMENT_CLEANUP_INTERVAL_MS',
    make: (work) => new AttachmentCleanupJob({ removeUnlinked: () => work() } as unknown as AttachmentsService),
  },
];

describe.each(JOBS)('$name tick()', ({ envSwitch, envInterval, make }) => {
  const saved: Record<string, string | undefined> = {};
  let errors: ReturnType<typeof vi.spyOn>;
  let logs: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    saved.switch = process.env[envSwitch];
    saved.interval = process.env[envInterval];
    errors = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    logs = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const [key, name] of [['switch', envSwitch], ['interval', envInterval]] as const) {
      if (saved[key] === undefined) delete process.env[name];
      else process.env[name] = saved[key];
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs one tick at a time: a tick while the previous one works does nothing, the next one after it runs again', async () => {
    let release!: (n: number) => void;
    const work = vi.fn<Work>(() => new Promise<number>((resolve) => (release = resolve)));
    const job = make(work);
    const first = job.tick();
    await job.tick(); // overlapping tick returns at once
    expect(work).toHaveBeenCalledTimes(1);
    release(2);
    await first;
    expect(logs).toHaveBeenCalledTimes(1); // "2" is reported; zero would be silent
    work.mockResolvedValueOnce(0);
    await job.tick();
    expect(work).toHaveBeenCalledTimes(2);
    expect(logs).toHaveBeenCalledTimes(1);
  });

  it('logs a failing tick and keeps working on the next one', async () => {
    const work = vi.fn<Work>().mockRejectedValueOnce(new Error('database away')).mockResolvedValueOnce(0);
    const job = make(work);
    await expect(job.tick()).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0][1])).toContain('database away');
    await job.tick();
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('ticks on the configured interval when enabled, never when switched off, and stops on shutdown', async () => {
    vi.useFakeTimers();
    const work = vi.fn<Work>().mockResolvedValue(0);
    process.env[envInterval] = '1000';
    delete process.env[envSwitch];
    const job = make(work);
    job.onModuleInit();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(work).toHaveBeenCalledTimes(3);
    job.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(work).toHaveBeenCalledTimes(3);

    process.env[envSwitch] = ' OFF ';
    const off = make(work);
    off.onModuleInit();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(work).toHaveBeenCalledTimes(3);
    off.onModuleDestroy(); // no timer: nothing to clear, no error
  });
});
