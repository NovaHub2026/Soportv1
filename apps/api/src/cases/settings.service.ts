import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Availability, computeAvailability, DEFAULT_SUPPORT_SETTINGS, type SupportSettings, type SupportSettingsInput } from '@orbit-support/shared';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { type SupportSettingsRow, supportSettings } from '../database/schema.js';
import type { StaffActor } from '../identity/identity.types.js';

const ROW_ID = 'default';

/**
 * Operating configuration (PH-5.4): one attributed row; the working defaults apply until a supervisor saves
 * (RULE-SUP-08 — the customer copy says whether hours are configured defaults). Supervisors and admins edit.
 */
@Injectable()
export class SettingsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async get(): Promise<SupportSettings> {
    const [row] = await this.db.select().from(supportSettings).where(eq(supportSettings.id, ROW_ID)).limit(1);
    if (!row) return { ...DEFAULT_SUPPORT_SETTINGS, workingDefault: true, updatedById: null, updatedByName: null, updatedAt: null };
    return toSettings(row);
  }

  async update(staff: StaffActor, input: SupportSettingsInput): Promise<SupportSettings> {
    if (staff.role === 'agent') throw new ForbiddenException('supervisor_required');
    const now = new Date();
    const values = {
      timezone: input.timezone,
      schedule: input.schedule as Record<string, unknown>,
      attentionThresholdHours: input.attentionThresholdHours,
      followUpWindowDays: input.followUpWindowDays,
      emailDelayMinutes: input.emailDelayMinutes,
      reminderAfterHours: input.reminderAfterHours,
      updatedById: staff.id,
      updatedByName: staff.displayName,
      updatedAt: now,
    };
    const [row] = await this.db
      .insert(supportSettings)
      .values({ id: ROW_ID, ...values })
      .onConflictDoUpdate({ target: supportSettings.id, set: values })
      .returning();
    return toSettings(row);
  }

  async availability(now = new Date()): Promise<Availability> {
    return computeAvailability(await this.get(), now);
  }

  async followUpWindowDays(): Promise<number> {
    return (await this.get()).followUpWindowDays;
  }

  async attentionThresholdHours(): Promise<number> {
    return (await this.get()).attentionThresholdHours;
  }
}

function toSettings(row: SupportSettingsRow): SupportSettings {
  return {
    timezone: row.timezone,
    schedule: row.schedule as SupportSettings['schedule'],
    attentionThresholdHours: row.attentionThresholdHours,
    followUpWindowDays: row.followUpWindowDays,
    emailDelayMinutes: row.emailDelayMinutes,
    reminderAfterHours: row.reminderAfterHours,
    workingDefault: false,
    updatedById: row.updatedById,
    updatedByName: row.updatedByName,
    updatedAt: row.updatedAt.toISOString(),
  };
}
