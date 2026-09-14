import { z } from "zod";
import type { CaseStatus, CaseSummary } from "./cases.js";

/**
 * Operating configuration (PH-5.4, context §4.4, §5.4, §13). Everything here is a working default until
 * Operations sets real values (BL-002); the customer copy says so (RULE-SUP-08).
 */
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time_hh_mm");

export const dayScheduleSchema = z
  .object({ open: timeSchema, close: timeSchema })
  .refine((d) => d.open < d.close, "open_before_close")
  .nullable();
export type DaySchedule = z.infer<typeof dayScheduleSchema>;

export const supportSettingsInputSchema = z.object({
  /** IANA time zone the schedule is expressed in. */
  timezone: z.string().trim().min(1).max(64),
  schedule: z.object(Object.fromEntries(WEEKDAYS.map((d) => [d, dayScheduleSchema])) as Record<Weekday, typeof dayScheduleSchema>),
  /** After this many hours without a human reply, a case is overdue in the supervision overview. */
  attentionThresholdHours: z.coerce.number().int().min(1).max(720),
  /** Days a resolved case stays reopenable before it closes (context §7.3, §13.1). */
  followUpWindowDays: z.coerce.number().int().min(1).max(90),
  /** Minutes a notification stays unread before an e-mail brings the customer back (PH-6.2); 0 = at once. */
  emailDelayMinutes: z.coerce.number().int().min(0).max(1440).default(15),
  /** Hours a case may wait for the customer before one reminder is sent (PH-6.3, §7.4). */
  reminderAfterHours: z.coerce.number().int().min(1).max(720).default(48),
});
export type SupportSettingsInput = z.infer<typeof supportSettingsInputSchema>;

export interface SupportSettings extends SupportSettingsInput {
  /** True until a supervisor saved the settings at least once: the values are the project's working defaults. */
  workingDefault: boolean;
  updatedById: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

/** Working defaults (context §13.1 spirit): weekdays 09:00–18:00 in São Paulo, 4 h attention, 7-day window. */
export const DEFAULT_SUPPORT_SETTINGS: SupportSettingsInput = {
  timezone: "America/Sao_Paulo",
  schedule: {
    mon: { open: "09:00", close: "18:00" },
    tue: { open: "09:00", close: "18:00" },
    wed: { open: "09:00", close: "18:00" },
    thu: { open: "09:00", close: "18:00" },
    fri: { open: "09:00", close: "18:00" },
    sat: null,
    sun: null,
  },
  attentionThresholdHours: 4,
  followUpWindowDays: 7,
  emailDelayMinutes: 15,
  reminderAfterHours: 48,
};

/** What the customer panel says about availability — computed from the schedule, never a promise (§4.4). */
export interface Availability {
  openNow: boolean;
  timezone: string;
  /** Today's window in the schedule's zone, or null when closed all day. */
  today: DaySchedule;
  /** The next opening as "wed 09:00" parts, or null when no day is open. */
  nextOpening: { weekday: Weekday; open: string } | null;
  workingDefault: boolean;
  checkedAt: string;
}

const WEEKDAY_BY_INDEX: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Local weekday and "HH:MM" of `now` in `timezone`. */
export function localClock(now: Date, timezone: string): { weekday: Weekday; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = (get("weekday").toLowerCase().slice(0, 3) as Weekday) || "mon";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { weekday, time: `${hour}:${get("minute")}` };
}

export function computeAvailability(settings: SupportSettings, now: Date = new Date()): Availability {
  const { weekday, time } = localClock(now, settings.timezone);
  const today = settings.schedule[weekday];
  const openNow = today !== null && time >= today.open && time < today.close;
  let nextOpening: Availability["nextOpening"] = null;
  const start = WEEKDAY_BY_INDEX.indexOf(weekday);
  for (let offset = 0; offset < 7 && !nextOpening; offset += 1) {
    const day = WEEKDAY_BY_INDEX[(start + offset) % 7];
    const window = settings.schedule[day];
    if (!window) continue;
    if (offset === 0 && time >= window.close) continue;
    if (offset === 0 && openNow) continue;
    nextOpening = { weekday: day, open: window.open };
  }
  return { openNow, timezone: settings.timezone, today, nextOpening, workingDefault: settings.workingDefault, checkedAt: now.toISOString() };
}

// ---- Supervision (PH-5.4, context §5.4) ----

export interface AgentLoad {
  agentId: string;
  open: number;
  awaitingReply: number;
}

export interface SupervisionOverview {
  byStatus: Record<CaseStatus, number>;
  unassigned: { count: number; oldestCreatedAt: string | null };
  awaitingReply: { count: number; oldestSince: string | null };
  byAgent: AgentLoad[];
  attentionThresholdHours: number;
  /** Cases awaiting a human reply for longer than the threshold, oldest first (at most 50). */
  overdue: CaseSummary[];
  computedAt: string;
}

export interface DurationStats {
  count: number;
  medianMinutes: number | null;
  p90Minutes: number | null;
}

/** Computed from history for a period; no targets exist until Operations defines them (§13.2, BL-002). */
export interface ServiceMetrics {
  periodDays: number;
  from: string;
  to: string;
  created: number;
  resolved: number;
  closed: number;
  reopened: number;
  /** Time from the customer's first message to the first public staff reply, for cases created in the period. */
  firstResponse: DurationStats;
  /** Time from creation to each resolution recorded in the period. */
  resolution: DurationStats;
  unansweredNow: { count: number; oldestMinutes: number | null };
  reopenRate: number | null;
  targets: null;
}

export function durationStats(minutes: number[]): DurationStats {
  if (minutes.length === 0) return { count: 0, medianMinutes: null, p90Minutes: null };
  const sorted = [...minutes].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
  return { count: sorted.length, medianMinutes: Math.round(at(0.5)), p90Minutes: Math.round(at(0.9)) };
}
