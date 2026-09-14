"use client";

import { type Availability, type CustomerCaseSummary, isStreamEvent, OPEN_CASE_STATUSES } from "@orbit-support/shared";
import { useCallback, useEffect, useState } from "react";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { type CustomerIdentity, customerApi, customerIdentityHeaders } from "@/lib/api";
import { subscribeStream } from "@/lib/sse";
import { StatusBadge } from "./StatusBadge";
import styles from "./support.module.css";
import { UnreadBadge } from "./UnreadBadge";

interface SupportHomeProps {
  identity: CustomerIdentity;
  onNewRequest: () => void;
  onOpenCase: (caseId: string) => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; cases: CustomerCaseSummary[] };

export function SupportHome({ identity, onNewRequest, onOpenCase }: SupportHomeProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const [availability, setAvailability] = useState<Availability | null>(null);

  // Availability comes from the configured schedule (RULE-SUP-08); without it, only the neutral copy is shown.
  useEffect(() => {
    const controller = new AbortController();
    customerApi
      .availability(identity, controller.signal)
      .then(setAvailability)
      .catch(() => undefined);
    return () => controller.abort();
  }, [identity]);

  useEffect(() => {
    const controller = new AbortController();
    customerApi
      .listCases(identity, controller.signal)
      .then((cases) => setState({ status: "ready", cases }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("support: could not load cases", error);
        setState((current) => (current.status === "ready" ? current : { status: "error" }));
      });
    return () => controller.abort();
  }, [identity, attempt]);

  // Any change on any of this customer's cases (a reply, a status) refreshes the lists and unread counts.
  useEffect(() => {
    const stop = subscribeStream("/support/cases/stream", customerIdentityHeaders(identity), {
      onEvent: (_type, data) => {
        if (isStreamEvent(data) && data.type !== "heartbeat") retry();
      },
      // Whatever happened while the stream was down is picked up on every (re)connect (ADR-0004).
      onStatus: (status) => {
        if (status === "connected") retry();
      },
    });
    return stop;
  }, [identity, retry]);

  const active = state.status === "ready" ? state.cases.filter((c) => OPEN_CASE_STATUSES.includes(c.status)) : [];
  const previous = state.status === "ready" ? state.cases.filter((c) => !OPEN_CASE_STATUSES.includes(c.status)) : [];

  return (
    <div className={styles.body}>
      <p className={styles.availability}>{t.support.home.availability}</p>
      {availability && (
        <p className={styles.availability} data-testid="availability" data-open={availability.openNow ? "true" : "false"}>
          {availability.openNow ? t.support.home.openNow : t.support.home.closedNow}{" "}
          {availability.today
            ? fill(t.support.home.todayHours, { open: availability.today.open, close: availability.today.close })
            : t.support.home.closedToday}
          {!availability.openNow && availability.nextOpening
            ? ` ${fill(t.support.home.nextOpening, { day: t.support.home.weekdays[availability.nextOpening.weekday], time: availability.nextOpening.open })}`
            : ""}
          {" "}
          <span className={styles.muted}>{availability.workingDefault ? t.support.home.scheduleDefault : fill(t.support.home.scheduleConfigured, { tz: availability.timezone })}</span>
        </p>
      )}
      <button type="button" className={styles.primaryButton} onClick={onNewRequest}>
        {t.support.home.talk}
      </button>

      {state.status === "loading" && (
        <p className={styles.muted} role="status">
          {t.support.home.loading}
        </p>
      )}
      {state.status === "error" && (
        <div className={styles.errorBox} role="alert">
          <p>{t.support.home.error}</p>
          <button type="button" className={styles.secondaryButton} onClick={retry}>
            {t.support.home.retry}
          </button>
        </div>
      )}
      {state.status === "ready" && state.cases.length === 0 && <p className={styles.muted}>{t.support.home.empty}</p>}

      {active.length > 0 && <CaseList title={t.support.home.active} cases={active} onOpenCase={onOpenCase} />}
      {previous.length > 0 && <CaseList title={t.support.home.previous} cases={previous} onOpenCase={onOpenCase} />}
    </div>
  );
}

function CaseList({ title, cases, onOpenCase }: { title: string; cases: CustomerCaseSummary[]; onOpenCase: (id: string) => void }) {
  return (
    <section className={styles.listSection}>
      <h3 className={styles.listTitle}>{title}</h3>
      <ul className={styles.caseList}>
        {cases.map((c) => (
          <li key={c.id}>
            <button type="button" className={styles.caseItem} onClick={() => onOpenCase(c.id)} data-unread={c.unreadCount > 0 ? "true" : "false"}>
              <span className={styles.caseItemTop}>
                <span className={styles.caseSubject}>{c.subject}</span>
                <span className={styles.caseItemBadges}>
                  <UnreadBadge count={c.unreadCount} one={t.support.conversation.unreadOne} many={t.support.conversation.unreadMany} />
                  <StatusBadge status={c.status} />
                </span>
              </span>
              <span className={styles.caseItemMeta}>
                {c.reference} · {t.category[c.category]} · {formatMessageTime(c.lastMessageAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
