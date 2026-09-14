/**
 * The window-message protocol between the broker's page (host) and the embedded support panel (PH-13.2,
 * DEC-0046 d). The host owns the session: it reads its own access-token cookie, posts it to the iframe and posts
 * it again whenever it refreshes; the panel keeps the token in memory only and asks again after a 401.
 * Every message carries `type` under this prefix; both sides check `event.origin` against an allow-list.
 */
export const EMBED_MESSAGE_PREFIX = "orbit-support:";

export type HostToPanelMessage =
  /** The customer's access token (also sent again after a refresh). */
  | { type: "orbit-support:session"; token: string; name?: string }
  /** The host signed out: forget everything. */
  | { type: "orbit-support:signout" }
  /** Open the panel on a case (a notification the host shows was clicked). */
  | { type: "orbit-support:open-case"; caseId: string };

export type PanelToHostMessage =
  /** The iframe is mounted and listening: the host may post the session now. */
  | { type: "orbit-support:ready" }
  /** The panel has a customer and is showing the home. */
  | { type: "orbit-support:signed-in"; customerId: string }
  /** The API refused the token (expired or invalid): the host refreshes and posts a session again. */
  | { type: "orbit-support:token-required" }
  /** The customer asked to close the panel. */
  | { type: "orbit-support:close" };

export function isHostMessage(data: unknown): data is HostToPanelMessage {
  if (!data || typeof data !== "object") return false;
  const { type } = data as { type?: unknown };
  return type === "orbit-support:session" || type === "orbit-support:signout" || type === "orbit-support:open-case";
}

/** The origins allowed to host the panel: `SUPPORT_EMBED_HOST_ORIGINS` (comma-separated), read by the `/embed` page at request time. */
export function allowedHostOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter((s) => /^https?:\/\/[^/\s]+$/.test(s));
}
