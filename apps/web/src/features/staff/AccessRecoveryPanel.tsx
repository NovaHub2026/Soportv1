"use client";

import { ACCESS_RECOVERY_STATUSES, type AccessRecoveryOutcome, type AccessRecoveryRequest, type AccessRecoveryStatus } from "@orbit-support/shared";
import { useCallback, useEffect, useState } from "react";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { ApiError } from "@/lib/api";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import styles from "./staff.module.css";

interface AccessRecoveryPanelProps {
  identity: StaffIdentity;
  onClose: () => void;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; requests: AccessRecoveryRequest[] };

/**
 * "Recuperação de acesso" (PH-7.1, context §4.5): unverified contacts from people who cannot sign in. Staff reach
 * the person and record one attributable outcome; the panel never shows or looks up any account (RULE-SUP-01).
 */
export function AccessRecoveryPanel({ identity, onClose }: AccessRecoveryPanelProps) {
  const r = t.staff.accessRecovery;
  const [filter, setFilter] = useState<AccessRecoveryStatus | "">("received");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "info"; text: string } | { kind: "error"; text: string }>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    staffApi
      .listAccessRecovery(identity, filter || undefined, controller.signal)
      .then((requests) => setState({ status: "ready", requests }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("staff: could not load recovery requests", error);
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [identity, filter, attempt]);

  async function handle(request: AccessRecoveryRequest, outcome: AccessRecoveryOutcome) {
    setStatus({ kind: "busy" });
    try {
      const note = notes[request.id]?.trim();
      await staffApi.handleAccessRecovery(identity, request.id, { outcome, ...(note ? { note } : {}) });
      setStatus({ kind: "info", text: fill(outcome === "forwarded" ? r.forwardedDone : r.closedDone, { reference: request.reference }) });
      reload();
    } catch (error) {
      console.warn("staff: could not handle recovery request", error);
      setStatus({ kind: "error", text: error instanceof ApiError && error.status === 409 ? r.alreadyHandled : r.failed });
    }
  }

  return (
    <section className={styles.panelPage} aria-label={r.title}>
      <header className={styles.panelHeader}>
        <h2 className={styles.caseTitle}>{r.title}</h2>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          {t.staff.savedReplies.back}
        </button>
      </header>
      <p className={styles.hint}>{r.intro}</p>
      <label className={styles.composerLabel}>
        {r.filter}
        <select className={styles.select} value={filter} onChange={(event) => setFilter(event.target.value as AccessRecoveryStatus | "")}>
          <option value="">{r.all}</option>
          {ACCESS_RECOVERY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {r.statuses[s]}
            </option>
          ))}
        </select>
      </label>
      {status.kind === "error" && (
        <p className={styles.errorText} role="alert">
          {status.text}
        </p>
      )}
      {status.kind === "info" && (
        <p className={styles.consultationMeta} role="status">
          {status.text}
        </p>
      )}
      {state.status === "loading" && <p className={styles.muted}>{t.staff.loading}</p>}
      {state.status === "error" && (
        <div className={styles.errorBox} role="alert">
          <p>{r.loadFailed}</p>
          <button type="button" className={styles.secondaryButton} onClick={reload}>
            {t.staff.retry}
          </button>
        </div>
      )}
      {state.status === "ready" && state.requests.length === 0 && <p className={styles.muted}>{r.empty}</p>}
      {state.status === "ready" && state.requests.length > 0 && (
        <ul className={styles.replyList}>
          {state.requests.map((request) => (
            <li key={request.id} className={styles.replyItem} data-testid="recovery-request">
              <div className={styles.replyHead}>
                <strong>
                  {request.reference} · {r.statuses[request.status]}
                </strong>
                <span className={styles.consultationMeta}>{formatMessageTime(request.createdAt)}</span>
              </div>
              <p className={styles.consultationMeta}>
                {r.contact}: {request.contact}
              </p>
              <p className={styles.replyBody}>{request.description}</p>
              {request.handledById && (
                <p className={styles.consultationMeta}>
                  {fill(r.handledBy, { agent: request.handledByName ?? request.handledById, time: request.handledAt ? formatMessageTime(request.handledAt) : "" })}
                  {request.note ? ` · ${request.note}` : ""}
                </p>
              )}
              {request.status === "received" && (
                <>
                  <label className={styles.composerLabel} htmlFor={`recovery-note-${request.id}`}>
                    {r.note}
                  </label>
                  <input
                    id={`recovery-note-${request.id}`}
                    className={styles.searchInput}
                    value={notes[request.id] ?? ""}
                    onChange={(event) => setNotes({ ...notes, [request.id]: event.target.value })}
                    maxLength={500}
                  />
                  <div className={styles.composerActions}>
                    <button type="button" className={styles.primaryButton} onClick={() => void handle(request, "forwarded")} disabled={status.kind === "busy"}>
                      {r.forward}
                    </button>
                    <button type="button" className={styles.secondaryButton} onClick={() => void handle(request, "closed")} disabled={status.kind === "busy"}>
                      {r.close}
                    </button>
                  </div>
                  <p className={styles.hint}>
                    <span className={styles.simBadge}>{t.app.simulationBadge}</span> {r.forwardHint}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
