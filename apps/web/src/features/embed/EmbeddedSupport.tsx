"use client";

import { useEffect, useMemo, useState } from "react";
import { SupportPanel } from "@/features/support/SupportPanel";
import { dictionary as t } from "@/i18n";
import { ApiError, whoAmI } from "@/lib/api";
import { allowedHostOrigins, isHostMessage, type PanelToHostMessage } from "./embed-protocol";
import styles from "./embed.module.css";

type State =
  | { name: "waiting" } // mounted, no session posted yet
  | { name: "resolving"; token: string }
  | { name: "ready"; token: string; customerId: string; displayName: string }
  | { name: "token-required" } // the API refused the token; the host was asked for a fresh one
  | { name: "refused" }; // not an allowed host, or nothing configured

/**
 * The customer panel inside the broker's app (PH-13.2, DEC-0046 d): an iframe the host mounts and hands the
 * customer's own access token through `postMessage`. Nothing identity-bound is rendered before a session arrives
 * from an allowed origin; the token lives in memory only; the API verifies it with the broker on every fresh
 * token, and a refusal asks the host for a refreshed one instead of showing anyone's data.
 */
export function EmbeddedSupport({ hostOrigins = allowedHostOrigins(process.env.NEXT_PUBLIC_EMBED_HOST_ORIGINS) }: { hostOrigins?: string[] }) {
  const [state, setState] = useState<State>(hostOrigins.length === 0 ? { name: "refused" } : { name: "waiting" });
  const [openCase, setOpenCase] = useState<{ caseId: string; seq: number; customerId: string } | null>(null);
  const hostOrigin = useMemo(() => hostOrigins, [hostOrigins]);

  const post = (message: PanelToHostMessage) => {
    if (window.parent === window) return;
    for (const origin of hostOrigin) window.parent.postMessage(message, origin);
  };

  useEffect(() => {
    if (hostOrigin.length === 0) return;
    const onMessage = (event: MessageEvent) => {
      if (!hostOrigin.includes(event.origin) || !isHostMessage(event.data)) return;
      const message = event.data;
      if (message.type === "orbit-support:signout") {
        setState({ name: "waiting" });
        setOpenCase(null);
      } else if (message.type === "orbit-support:session") {
        if (typeof message.token === "string" && message.token.length > 0) setState({ name: "resolving", token: message.token });
      } else if (message.type === "orbit-support:open-case") {
        setState((current) => {
          if (current.name === "ready") setOpenCase({ caseId: message.caseId, seq: Date.now(), customerId: current.customerId });
          return current;
        });
      }
    };
    window.addEventListener("message", onMessage);
    post({ type: "orbit-support:ready" });
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the host list is fixed at build time
  }, [hostOrigin]);

  useEffect(() => {
    if (state.name !== "resolving") return;
    const { token } = state;
    const controller = new AbortController();
    whoAmI(token, controller.signal)
      .then((me) => {
        if (controller.signal.aborted) return;
        if (me.kind !== "customer") {
          setState({ name: "token-required" });
          return;
        }
        setState({ name: "ready", token, customerId: me.id, displayName: "" });
        post({ type: "orbit-support:signed-in", customerId: me.id });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // 401/403: the broker refused the token — ask the host for a fresh one; anything else: try again on the next post.
        setState({ name: "token-required" });
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) post({ type: "orbit-support:token-required" });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `post` only depends on the fixed host list
  }, [state]);

  if (state.name === "refused") {
    return (
      <p className={styles.notice} role="alert" data-testid="embed-refused">
        {t.embed.refused}
      </p>
    );
  }
  if (state.name !== "ready") {
    return (
      <p className={styles.notice} role="status" data-testid="embed-waiting">
        {state.name === "token-required" ? t.embed.tokenRequired : t.embed.waiting}
      </p>
    );
  }
  return (
    <div className={styles.frame} data-testid="embed-panel">
      <SupportPanel key={`${state.customerId}:${state.token.slice(-8)}`} customer={{ id: state.customerId, name: state.displayName, bearer: state.token }} openCase={openCase} onClose={() => post({ type: "orbit-support:close" })} />
    </div>
  );
}
