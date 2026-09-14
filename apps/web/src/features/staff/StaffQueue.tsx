"use client";

import { type CaseSummary, STAFF_QUEUE_VIEWS, type StaffQueueView } from "@orbit-support/shared";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/features/support/StatusBadge";
import { dictionary as t, formatMessageTime } from "@/i18n";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import styles from "./staff.module.css";

/** Safety-net refresh while the staff stream is down (ADR-0004). */
export const QUEUE_REFRESH_INTERVAL_MS = 10_000;
/** Safety-net refresh while the staff stream is connected. */
export const QUEUE_CONNECTED_REFRESH_INTERVAL_MS = 60_000;

interface StaffQueueProps {
  identity: StaffIdentity;
  view: StaffQueueView;
  onViewChange: (view: StaffQueueView) => void;
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  /** Bumped by the workspace whenever the live stream or an action says something changed. */
  refreshToken: number;
  /** Whether the live stream is connected; only changes the safety-net cadence. */
  live?: boolean;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; cases: CaseSummary[] };

export function StaffQueue({ identity, view, onViewChange, selectedCaseId, onSelectCase, refreshToken, live = false }: StaffQueueProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // Monotonic request counter: a poll that started before an action must not overwrite the refreshed list.
  const requestSeq = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const id = ++requestSeq.current;
      try {
        const cases = await staffApi.listCases(identity, view, controller.signal);
        if (id !== requestSeq.current) return;
        setState({ status: "ready", cases });
      } catch (error: unknown) {
        if (controller.signal.aborted || id !== requestSeq.current) return;
        console.warn("staff: could not load queue", error);
        setState((current) => (current.status === "ready" ? current : { status: "error" }));
      }
    };
    void load();
    const timer = setInterval(load, live ? QUEUE_CONNECTED_REFRESH_INTERVAL_MS : QUEUE_REFRESH_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [identity, view, refreshToken, attempt, live]);

  return (
    <section className={styles.queue} aria-label={t.staff.queues[view]}>
      <div className={styles.tabs} role="tablist">
        {STAFF_QUEUE_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={v === view}
            className={styles.tab}
            data-active={v === view ? "true" : "false"}
            onClick={() => onViewChange(v)}
          >
            {t.staff.queues[v]}
          </button>
        ))}
      </div>

      {state.status === "loading" && (
        <p className={styles.muted} role="status">
          {t.staff.loading}
        </p>
      )}
      {state.status === "error" && (
        <div className={styles.errorBox} role="alert">
          <p>{t.staff.error}</p>
          <button type="button" className={styles.secondaryButton} onClick={() => setAttempt((n) => n + 1)}>
            {t.staff.retry}
          </button>
        </div>
      )}
      {state.status === "ready" && state.cases.length === 0 && <p className={styles.muted}>{t.staff.queueEmpty[view]}</p>}
      {state.status === "ready" && state.cases.length > 0 && (
        <ul className={styles.caseList}>
          {state.cases.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={styles.caseItem}
                data-selected={c.id === selectedCaseId ? "true" : "false"}
                onClick={() => onSelectCase(c.id)}
              >
                <span className={styles.caseItemTop}>
                  <span className={styles.caseReference}>{c.reference}</span>
                  <StatusBadge status={c.status} labels={t.staff.status} />
                </span>
                <span className={styles.caseSubject}>{c.subject}</span>
                <span className={styles.caseMeta}>
                  {c.customerId} · {t.category[c.category]} · {t.staff.priority[c.priority]} · {formatMessageTime(c.lastMessageAt)}
                </span>
                <span className={styles.caseMeta}>
                  {t.staff.responsible}: {c.assignedAgentId ?? t.staff.unassigned}
                  {c.assignedAgentId === identity.staffId ? ` (${t.staff.you})` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
