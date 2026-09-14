"use client";

/**
 * PROPOSAL for the broker's repository (optaqode-frontend2.0) — not compiled here. Mounts Orbit Support's customer
 * panel in an iframe and hands it the customer's own access token through `postMessage` (PH-13.2, DEC-0046 d).
 *
 * Where it goes in the broker: `src/platforms/app/components/support/OrbitSupportPanel.tsx`; a launcher in the
 * header's right cluster (`Header.tsx`, next to `NotificationsButton`) toggles `open`; add "/suporte" to
 * `PLATFORM_CONFIG.app.routePaths` if a full page is wanted; set `NEXT_PUBLIC_ORBIT_SUPPORT_URL` to the panel's
 * origin (e.g. https://support.orbitmarket.pro). The panel's own build lists this host in
 * `SUPPORT_EMBED_HOST_ORIGINS`. The anti-inspection guard must ignore the iframe's size changes.
 *
 * The token is read from the same cookie the broker's own browser client uses (`optaqode.app.token`,
 * httpOnly: false — `src/lib/auth/session.ts`); the broker's refresh keeps working because the host re-posts the
 * token whenever the cookie changes or the panel asks for it.
 */
import { useEffect, useRef } from "react";

const SUPPORT_ORIGIN = process.env.NEXT_PUBLIC_ORBIT_SUPPORT_URL ?? "";
const TOKEN_COOKIE = "optaqode.app.token";

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function OrbitSupportPanel({ open, onClose, displayName }: { open: boolean; onClose: () => void; displayName?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open || !SUPPORT_ORIGIN) return;
    const post = (message: unknown) => frame.current?.contentWindow?.postMessage(message, SUPPORT_ORIGIN);
    const sendSession = () => {
      const token = readCookie(TOKEN_COOKIE);
      post(token ? { type: "orbit-support:session", token, name: displayName } : { type: "orbit-support:signout" });
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== SUPPORT_ORIGIN || !event.data || typeof event.data !== "object") return;
      const { type } = event.data as { type?: string };
      if (type === "orbit-support:ready" || type === "orbit-support:token-required") sendSession();
      if (type === "orbit-support:close") onClose();
    };
    window.addEventListener("message", onMessage);
    // The broker refreshes its token in the background: re-post whenever the cookie value changes.
    let last = readCookie(TOKEN_COOKIE);
    const watch = window.setInterval(() => {
      const current = readCookie(TOKEN_COOKIE);
      if (current !== last) {
        last = current;
        sendSession();
      }
    }, 5000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(watch);
    };
  }, [open, onClose, displayName]);

  if (!open || !SUPPORT_ORIGIN) return null;
  return (
    <aside aria-label="Suporte" style={{ position: "fixed", right: 0, top: "var(--trading-header-height, 4.5rem)", bottom: 0, width: "min(420px, 100vw)", zIndex: "var(--layer-modal, 120)" }}>
      <iframe
        ref={frame}
        title="Suporte"
        src={`${SUPPORT_ORIGIN}/embed`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ border: 0, width: "100%", height: "100%", background: "#000" }}
      />
    </aside>
  );
}
