"use client";

import { type CustomerNotification, isStreamEvent } from "@orbit-support/shared";
import { useCallback, useEffect, useState } from "react";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { type CustomerIdentity, customerApi, customerIdentityHeaders } from "@/lib/api";
import { subscribeStream } from "@/lib/sse";
import styles from "./shell.module.css";

interface NotificationsBellProps {
  identity: CustomerIdentity;
  /** Open the conversation of a case; the panel marks that case's notifications read. */
  onOpenCase: (caseId: string) => void;
  /** Bumped by the host when something it did (opening a case) may have changed the count. */
  refreshToken?: number;
}

/**
 * In-product notifications in the host (PH-6.1, context §4.4): a badge with the unread count and a list that
 * opens the conversation. Refreshed live over the customer-wide stream; never shows message content.
 */
export function NotificationsBell({ identity, onOpenCase, refreshToken = 0 }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    customerApi
      .listNotifications(identity, controller.signal)
      .then((result) => {
        setItems(result.notifications);
        setUnread(result.unread);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("shell: could not load notifications", error);
        setFailed(true); // the list says so instead of pretending there is nothing (FND-0041)
      });
    return () => controller.abort();
  }, [identity, attempt, refreshToken]);

  useEffect(() => {
    const stop = subscribeStream("/support/cases/stream", customerIdentityHeaders(identity), {
      onEvent: (_type, data) => {
        if (isStreamEvent(data) && data.type !== "heartbeat") refresh();
      },
      onStatus: (status) => {
        if (status === "connected") refresh();
      },
    });
    return stop;
  }, [identity, refresh]);

  const n = t.support.notifications;
  return (
    <div className={styles.bell}>
      <button type="button" className={styles.bellButton} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={unread > 0 ? fill(n.unreadLabel, { n: String(unread) }) : n.label}>
        {n.label}
        {unread > 0 && (
          <span className={styles.bellBadge} data-testid="notifications-badge">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <ul className={styles.bellList} aria-label={n.label}>
          {failed && (
            <li className={styles.bellEmpty} role="alert">
              {n.failed}{" "}
              <button type="button" className={styles.bellRetry} onClick={refresh}>
                {n.retry}
              </button>
            </li>
          )}
          {!failed && items.length === 0 && <li className={styles.bellEmpty}>{n.empty}</li>}
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.bellItem}
                data-read={item.readAt ? "true" : "false"}
                onClick={() => {
                  setOpen(false);
                  onOpenCase(item.caseId);
                }}
              >
                <span>{fill(n.kinds[item.kind], { reference: item.caseReference })}</span>
                <span className={styles.bellTime}>{formatMessageTime(item.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
