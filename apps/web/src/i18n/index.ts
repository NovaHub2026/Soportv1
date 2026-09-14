import type { Weekday } from "@orbit-support/shared";
import { type Dictionary, ptBR } from "./pt-BR";

export const SUPPORTED_LOCALES = ["pt-BR"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const dictionaries: Record<Locale, Dictionary> = { "pt-BR": ptBR };

/** One dictionary per locale; Spanish is added here later without touching components (context §10.1). */
export function getDictionary(locale: Locale = "pt-BR"): Dictionary {
  return dictionaries[locale];
}

/** The active customer locale. pt-BR only until locale detection arrives with the real Orbit session. */
export const dictionary = getDictionary("pt-BR");

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** `1,2 MB`, `340 KB` — pt-BR decimal comma. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Replaces `{name}` placeholders in a dictionary string. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

/** `14:05` when today, `13/09 14:05` otherwise. */
/** Elapsed time in short pt-BR: "5 min", "3 h", "2 d". */
export function formatDuration(sinceIso: string, now: Date = new Date()): string {
  return formatMinutes(Math.max(0, Math.round((now.getTime() - new Date(sinceIso).getTime()) / 60_000)));
}

/** A duration in minutes as short pt-BR from the dictionary units (BL-024): "5 min", "3 h", "2 d". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} ${dictionary.units.minutes}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} ${dictionary.units.hours}`;
  return `${Math.floor(hours / 24)} ${dictionary.units.days}`;
}

export function formatMessageTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return (sameDay ? timeFormat : dateTimeFormat).format(date);
}

const WEEKDAY_KEYS: readonly Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** The customer's own time zone — the browser's (DEC-0039 a). */
export function customerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** An instant as the customer's weekday key and "HH:MM" in the browser's zone (PH-10.1). */
export function localOpening(iso: string): { weekday: Weekday; time: string } {
  const date = new Date(iso);
  return { weekday: WEEKDAY_KEYS[date.getDay()], time: timeFormat.format(date) };
}

/** Whether an instant is already behind us (deadlines; kept out of components like formatDuration). */
export function isPast(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).getTime() <= now.getTime();
}
