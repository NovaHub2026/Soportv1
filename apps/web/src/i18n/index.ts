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
export function formatMessageTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return (sameDay ? timeFormat : dateTimeFormat).format(date);
}
