"use client";

import { type Availability, type CustomerCaseSummary, type EmailNotification, isAllDay, isStreamEvent, OPEN_CASE_STATUSES } from "@orbit-support/shared";
import { useCallback, useEffect, useState } from "react";
import { customerTimeZone, dictionary as t, fill, isPast, localOpening, formatMessageTime } from "@/i18n";

/**
 * The operation's current day as the customer's clock reads it (DEC-0039 a). "Hoje" is only said when the window
 * opens on the customer's own calendar day; otherwise the weekday is named; a window already behind the customer is
 * omitted (the next opening follows) — closing audit FND-0111.
 */
function windowLine(window: Availability["todayWindow"], allDay: boolean): string {
  if (!window) return ` ${t.support.home.closedToday}`;
  if (isPast(window.closesAt)) return "";
  const opens = localOpening(window.opensAt);
  const closes = localOpening(window.closesAt);
  const today = opens.weekday === localOpening(new Date().toISOString()).weekday;
  const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (allDay) return ` ${today ? t.support.home.todayAllDay : fill(t.support.home.openUntil, { day: t.support.home.weekdays[closes.weekday], time: closes.time })}`;
  if (today) return ` ${fill(t.support.home.todayHours, { open: opens.time, close: closes.time })}`;
  return ` ${fill(t.support.home.dayHours, { day: capital(t.support.home.weekdays[opens.weekday]), open: opens.time, close: closes.time })}`;
}
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
  // null = still loading, "error" = could not load (said so, never assumed) — FND-0041.
  const [emailPreference, setEmailPreference] = useState<boolean | null | "error">(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailNotification[] | null | "error">(null);

  // Preference and the labeled simulated outbox (PH-6.2); a failure is shown as such (RULE-SUP-07).
  useEffect(() => {
    const controller = new AbortController();
    customerApi
      .getPreferences(identity, controller.signal)
      .then((p) => setEmailPreference(typeof p?.emailNotifications === "boolean" ? p.emailNotifications : "error"))
      .catch(() => {
        if (!controller.signal.aborted) setEmailPreference("error");
      });
    customerApi
      .listEmails(identity, controller.signal)
      .then((result) => setEmails(Array.isArray(result?.emails) ? result.emails : "error"))
      .catch(() => {
        if (!controller.signal.aborted) setEmails("error");
      });
    return () => controller.abort();
  }, [identity, attempt]);

  const toggleEmails = (value: boolean) => {
    setEmailPreference(value);
    setPreferenceError(null);
    customerApi.updatePreferences(identity, { emailNotifications: value }).catch((error: unknown) => {
      console.warn("support: could not save the e-mail preference", error);
      setEmailPreference(!value); // the previous value stays in force and the customer is told (FND-0041)
      setPreferenceError(t.support.emails.preferenceFailed);
    });
  };

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
          {/* Times are instants formatted in the customer's own zone (DEC-0039 a); 24/7 has nothing to announce. */}
          {availability.alwaysOpen ? (
            t.support.home.alwaysOpen
          ) : (
            <>
              {availability.openNow ? t.support.home.openNow : t.support.home.closedNow}
              {windowLine(availability.todayWindow, Boolean(availability.today && isAllDay(availability.today)))}
              {!availability.openNow && availability.nextOpeningAt
                ? ` ${fill(t.support.home.nextOpening, { day: t.support.home.weekdays[localOpening(availability.nextOpeningAt).weekday], time: localOpening(availability.nextOpeningAt).time })}`
                : ""}
            </>
          )}
          {" "}
          <span className={styles.muted}>{fill(t.support.home.yourZone, { tz: customerTimeZone() })}</span>
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

      {typeof emailPreference === "boolean" && (
        <label className={styles.preference}>
          <input type="checkbox" checked={emailPreference} onChange={(event) => toggleEmails(event.target.checked)} />
          <span>
            {t.support.emails.preference}
            <span className={styles.muted}> {t.support.emails.preferenceHint}</span>
          </span>
        </label>
      )}
      {emailPreference === "error" && (
        <p className={styles.muted} role="note">
          {t.support.emails.preferenceUnavailable}
        </p>
      )}
      {preferenceError && (
        <p className={styles.errorText} role="alert">
          {preferenceError}
        </p>
      )}
      <section className={styles.listSection} aria-label={t.support.emails.outboxTitle} data-testid="email-outbox">
        <h3 className={styles.listTitle}>
          {t.support.emails.outboxTitle} <span className={styles.simBadge}>{t.app.simulationBadge}</span>
        </h3>
        <p className={styles.muted}>{t.support.emails.outboxHint}</p>
        {emails === null && <p className={styles.muted}>{t.support.home.loading}</p>}
        {emails === "error" && (
          <p className={styles.errorText} role="alert">
            {t.support.emails.outboxError}{" "}
            <button type="button" className={styles.linkButton} onClick={retry}>
              {t.support.home.retry}
            </button>
          </p>
        )}
        {Array.isArray(emails) && emails.length === 0 && <p className={styles.muted}>{t.support.emails.outboxEmpty}</p>}
        {Array.isArray(emails) && emails.length > 0 && (
          <ul className={styles.caseList}>
            {emails.map((email) => (
              <li key={email.id}>
                <button type="button" className={styles.caseItem} onClick={() => onOpenCase(email.caseId)}>
                  <span className={styles.caseSubject}>{email.subject}</span>
                  <span className={styles.caseItemMeta}>
                    {fill(t.support.emails.to, { to: email.toMasked })} · {formatMessageTime(email.createdAt)} · {t.support.emails.open}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
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
