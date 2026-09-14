import { describe, expect, test } from "vitest";
import { businessDaysAfter, computeAvailability, DEFAULT_SUPPORT_SETTINGS, durationStats, isAllDay, supportSettingsInputSchema, zonedInstant } from "./settings.js";

/** The pre-DEC-0039 weekday schedule, kept as the fixture of the opening/closing rules. */
const weekdays = { mon: { open: "09:00", close: "18:00" }, tue: { open: "09:00", close: "18:00" }, wed: { open: "09:00", close: "18:00" }, thu: { open: "09:00", close: "18:00" }, fri: { open: "09:00", close: "18:00" }, sat: null, sun: null };
const settings = { ...DEFAULT_SUPPORT_SETTINGS, schedule: weekdays, workingDefault: true, updatedById: null, updatedByName: null, updatedAt: null };

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
    expect(saturday.alwaysOpen).toBe(false);
  });

  test("PH-10.1 (DEC-0039 a): the decided default is 24/7 in São Paulo time, and the availability carries instants for the customer's zone", () => {
    const decided = { ...DEFAULT_SUPPORT_SETTINGS, workingDefault: true, updatedById: null, updatedByName: null, updatedAt: null };
    expect(Object.values(DEFAULT_SUPPORT_SETTINGS.schedule).every(isAllDay)).toBe(true);
    const sunday = computeAvailability(decided, new Date("2026-09-20T02:30:00.000Z")); // Saturday 23:30 in São Paulo
    expect(sunday).toMatchObject({ openNow: true, alwaysOpen: true, nextOpening: null, nextOpeningAt: null });
    expect(sunday.todayWindow).toEqual({ opensAt: "2026-09-19T03:00:00.000Z", closesAt: "2026-09-20T03:00:00.000Z" });
    // A weekday schedule: Wednesday 19:30 in São Paulo → next opening Thursday 09:00 = 12:00 UTC.
    const evening = computeAvailability(settings, new Date("2026-09-16T22:30:00.000Z"));
    expect(evening.todayWindow).toEqual({ opensAt: "2026-09-16T12:00:00.000Z", closesAt: "2026-09-16T21:00:00.000Z" });
    expect(evening.nextOpeningAt).toBe("2026-09-17T12:00:00.000Z");
    expect(evening.alwaysOpen).toBe(false);
    // Instants follow the zone's offset, daylight saving included (Madrid, +2 in September).
    expect(zonedInstant({ year: 2026, month: 9, day: 16 }, "09:00", "Europe/Madrid").toISOString()).toBe("2026-09-16T07:00:00.000Z");
    expect(zonedInstant({ year: 2026, month: 9, day: 16 }, "24:00", "America/Sao_Paulo").toISOString()).toBe("2026-09-17T03:00:00.000Z");
    // "24:00" closes a day; it never opens one.
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, schedule: { ...DEFAULT_SUPPORT_SETTINGS.schedule, mon: { open: "24:00", close: "24:00" } } }).success).toBe(false);
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, schedule: { ...DEFAULT_SUPPORT_SETTINGS.schedule, mon: { open: "09:00", close: "24:01" } } }).success).toBe(false);
  });

  test("a schedule with no open day has no next opening", () => {
    const closed = { ...settings, schedule: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null } };
    expect(computeAvailability(closed, new Date("2026-09-16T15:00:00.000Z"))).toMatchObject({ openNow: false, nextOpening: null });
  });

  test("the next opening is next week when the only open day is today and it already closed (FND-0043)", () => {
    const wedOnly = { ...settings, schedule: { mon: null, tue: null, wed: { open: "09:00", close: "18:00" }, thu: null, fri: null, sat: null, sun: null } };
    // Wednesday 22:30 UTC = 19:30 in São Paulo: closed for today, next opening next Wednesday.
    expect(computeAvailability(wedOnly, new Date("2026-09-16T22:30:00.000Z"))).toMatchObject({ openNow: false, nextOpening: { weekday: "wed", open: "09:00" } });
  });

  test("an unknown time zone is refused on input and fails closed when stored (FND-0030)", () => {
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, timezone: "UTC\u0000" }).success).toBe(false);
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, timezone: "Europe/Madrid" }).success).toBe(true);
    expect(computeAvailability({ ...settings, timezone: "Mars/Olympus" }, new Date("2026-09-16T15:00:00.000Z"))).toMatchObject({ openNow: false, today: null, nextOpening: null });
  });

  test("settings input validates times and ordering", () => {
    expect(supportSettingsInputSchema.safeParse(DEFAULT_SUPPORT_SETTINGS).success).toBe(true);
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, schedule: { ...DEFAULT_SUPPORT_SETTINGS.schedule, mon: { open: "18:00", close: "09:00" } } }).success).toBe(false);
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, attentionThresholdHours: 0 }).success).toBe(false);
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, emailDelayMinutes: 0 }).success).toBe(true);
    // JSON bodies carry numbers; booleans and strings are not coerced (FND-0048).
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, attentionThresholdHours: true }).success).toBe(false);
    expect(supportSettingsInputSchema.safeParse({ ...DEFAULT_SUPPORT_SETTINGS, attentionThresholdHours: "4" }).success).toBe(false);
  });
});

describe("businessDaysAfter (DEC-0039 g)", () => {
  test("counts Monday–Friday in the operation's zone, keeps the wall-clock time, and starts a weekend from Monday", () => {
    // Wednesday 2026-09-16 15:00 São Paulo (18:00 UTC) + 5 business days → Wednesday 2026-09-23 15:00.
    expect(businessDaysAfter(new Date("2026-09-16T18:00:00.000Z"), 5, "America/Sao_Paulo").toISOString()).toBe("2026-09-23T18:00:00.000Z");
    // Friday 17:30 + 1 → Monday 17:30; Saturday 10:00 + 1 → Monday 10:00.
    expect(businessDaysAfter(new Date("2026-09-18T20:30:00.000Z"), 1, "America/Sao_Paulo").toISOString()).toBe("2026-09-21T20:30:00.000Z");
    expect(businessDaysAfter(new Date("2026-09-19T13:00:00.000Z"), 1, "America/Sao_Paulo").toISOString()).toBe("2026-09-21T13:00:00.000Z");
    // Across a daylight-saving change the wall-clock time is kept (Madrid: 2026-10-25 leaves summer time).
    expect(businessDaysAfter(new Date("2026-10-22T07:00:00.000Z"), 5, "Europe/Madrid").toISOString()).toBe("2026-10-29T08:00:00.000Z");
  });
});

describe("durationStats", () => {
  test("gives median and p90 with the sample size, and nulls without samples", () => {
    expect(durationStats([])).toEqual({ count: 0, medianMinutes: null, p90Minutes: null });
    expect(durationStats([10, 20, 30, 40, 100])).toEqual({ count: 5, medianMinutes: 30, p90Minutes: 100 });
  });
});
