import type { CaseMessage, Weekday } from "@orbit-support/shared";
import { dictionary as t, fill } from "@/i18n";

/**
 * The words of a system message come from the dictionary (BL-024, FND-0056): the API stores what the notice is
 * (`systemKind`) and its values (`systemData`), so a second locale words it without touching the API. `body` is the
 * pt-BR text as written at the time; it is shown for people's messages, for notices older than migration `0019` and
 * for a kind this client does not know yet.
 */
export function systemMessageText(message: Pick<CaseMessage, "authorType" | "body" | "systemKind" | "systemData">): string {
  if (message.authorType !== "system" || !message.systemKind) return message.body;
  const data = message.systemData ?? {};
  switch (message.systemKind) {
    case "follow_up_of":
      return fill(t.systemMessages.followUpOf, { reference: data.reference ?? "" });
    case "outside_hours": {
      const day = data.weekday as Weekday | undefined;
      const next = day && data.open && day in t.support.home.weekdays ? ` ${fill(t.support.home.nextOpening, { day: t.support.home.weekdays[day], time: data.open })}` : "";
      return `${t.systemMessages.outsideHours}${next}`;
    }
    default:
      return message.body;
  }
}
