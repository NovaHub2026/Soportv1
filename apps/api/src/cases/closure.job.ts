import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { positiveNumberEnv } from '../common/env.js';
import { CasesService } from './cases.service.js';
import { SettingsService } from './settings.service.js';

/**
 * Closes resolved cases once the follow-up window has elapsed (PH-3.4, context §7.3). Runs inside the API
 * process on an interval — one instance only until PH-8 decides on scheduling. `SUPPORT_CLOSURE_JOB=off`
 * disables it (tests exercise `closeExpired` directly); `SUPPORT_CLOSURE_INTERVAL_MS` sets the cadence.
 */
@Injectable()
export class ClosureJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClosureJob.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  /** A slow tick must not overlap the next one: the closure is per-row locked, but double work is still waste. */
  private running = false;

  constructor(
    private readonly cases: CasesService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    if (process.env.SUPPORT_CLOSURE_JOB === 'off') return;
    const intervalMs = positiveNumberEnv('SUPPORT_CLOSURE_INTERVAL_MS', 60_000);
    this.timer = setInterval(() => void this.tick(), intervalMs);
    // Never keep the process alive just for this timer.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // The configured follow-up window (PH-5.4) wins over the environment default.
      const closed = await this.cases.closeExpired(new Date(), await this.settings.followUpWindowDays());
      if (closed > 0) this.logger.log(`Closed ${closed} resolved case(s) past the follow-up window`);
    } catch (error) {
      this.logger.error('Closure job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
