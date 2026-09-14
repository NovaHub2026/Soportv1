import { describe, expect, test } from "vitest";
import { computeAvailability, DEFAULT_SUPPORT_SETTINGS, durationStats, supportSettingsInputSchema } from "./settings.js";

const settings = { ...DEFAULT_SUPPORT_SETTINGS, workingDefault: true, updatedById: null, updatedByName: null, updatedAt: null };

describe("availability from the configured schedule (RULE-SUP-08)", () => {
  test("is open inside the window and closed outside it, with the next opening", () => {
    // 2026-09-16 is a Wednesday. 15:00 UTC = 12:00 in São Paulo (UTC-3).
    const open = computeAvailability(settings, new Date("2026-09-16T15:00:00.000Z"));
    expect(open.openNow).toBe(true);
    expect(open.today).toEqual({ open: "09:00", close: "18:00" });
    // 22:30 UTC = 19:30 local → closed; next opening Thursday 09:00.
    const evening = computeAvailability(settings, new Date("2026-09-16T22:30:00.000Z"));
    expect(evening.openNow).toBe(false);
    expect(evening.nextOpening).toEqual({ weekday: "thu", open: "09:00" });
    // Saturday 12:00 local → closed all day; next opening Monday.
    const saturday = computeAvailability(settings, new Date("2026-09-19T15:00:00.000Z"));
    expect(saturday.today).toBeNull();
    expect(saturday.nextOpening).toEqual({ weekday: "mon", open: "09:00" });
    expect(saturday.workingDefault).toBe(true);
  });

  test("a schedule with no open day has no next opening", () => {
    const closed = { ...settings, schedule: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null } };
    expect(computeAvailability(closed, new Date("2026-09-16T15:00:00.000Z"))).toMatchObject({ openNow: false, nextOpening: null });
  });

  test("settings input validates times and ordering", () => {
    expect(supportSettingsInputSchema.safeParse(DEFAULT_SUPPORT_SETTINGS).success).toBe(true);
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, schedule: { ...DEFAULT_SUPPORT_SETTINGS.schedule, mon: { open: "18:00", close: "09:00" } } }).success).toBe(false);
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, attentionThresholdHours: 0 }).success).toBe(false);
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, emailDelayMinutes: 0 }).success).toBe(true);
  });
});

describe("durationStats", () => {
  test("gives median and p90 with the sample size, and nulls without samples", () => {
    expect(durationStats([])).toEqual({ count: 0, medianMinutes: null, p90Minutes: null });
    expect(durationStats([10, 20, 30, 40, 100])).toEqual({ count: 5, medianMinutes: 30, p90Minutes: 100 });
  });
});
