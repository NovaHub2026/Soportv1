import type { CaseMessage, Weekday } from "@orbit-support/shared";
import { dictionary as t, fill, localOpening } from "@/i18n";

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
      // Without its value the notice keeps the text stored with it (Cycle Audit 3 FND-0092).
      return data.reference ? fill(t.systemMessages.followUpOf, { reference: data.reference }) : message.body;
    case "outside_hours": {
      // The instant, when stored (PH-10.1), is worded in the customer's zone; older notices keep the operation's weekday and time.
      const opening = data.nextOpeningAt ? localOpening(data.nextOpeningAt) : null;
      const day = (opening?.weekday ?? data.weekday) as Weekday | undefined;
      const time = opening?.time ?? data.open;
      const next = day && time && Object.prototype.hasOwnProperty.call(t.support.home.weekdays, day) ? ` ${fill(t.support.home.nextOpening, { day: t.support.home.weekdays[day], time })}` : "";
      return `${t.systemMessages.outsideHours}${next}`;
    }
    default:
      return message.body;
  }
}
