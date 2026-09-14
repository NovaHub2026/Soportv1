"use client";

import { CASE_STATUSES, type ServiceMetrics, type SupervisionOverview, type SupportSettings, WEEKDAYS, type Weekday } from "@orbit-support/shared";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { dictionary as t, fill, formatDuration, formatMessageTime } from "@/i18n";
import { ApiError } from "@/lib/api";
import { SIMULATED_STAFF } from "@/lib/simulated-session";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import styles from "./staff.module.css";

interface SupervisionPanelProps {
  identity: StaffIdentity;
  onClose: () => void;
  onOpenCase: (caseId: string) => void;
}

const minutes = (value: number | null) => (value === null ? t.staff.supervision.noData : value < 60 ? `${value} min` : value < 2880 ? `${Math.round(value / 60)} h` : `${Math.round(value / 1440)} d`);

/**
 * Supervision (PH-5.4, context §5.4): outstanding demand, overdue follow-up with reassignment, service metrics
 * without targets, and the operating configuration. Supervisors and admins only (simulated role until PH-7).
 */
export function SupervisionPanel({ identity, onClose, onOpenCase }: SupervisionPanelProps) {
  const s = t.staff.supervision;
  const [overview, setOverview] = useState<SupervisionOverview | null>(null);
  const [metrics, setMetrics] = useState<ServiceMetrics | null>(null);
  const [days, setDays] = useState<7 | 30>(7);
  const [settings, setSettings] = useState<SupportSettings | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "info"; text: string } | { kind: "error"; text: string }>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([staffApi.overview(identity, controller.signal), staffApi.metrics(identity, days, controller.signal), staffApi.getSettings(identity, controller.signal)])
      .then(([o, m, st]) => {
        setOverview(o);
        setMetrics(m);
        setSettings(st);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("staff: could not load supervision", error);
        setStatus({ kind: "error", text: error instanceof ApiError && error.status === 403 ? t.staff.supervision.forbidden : t.staff.supervision.failed });
      });
    return () => controller.abort();
  }, [identity, days, attempt]);

  async function reassign(caseId: string, agentId: string) {
    setStatus({ kind: "busy" });
    try {
      await staffApi.assign(identity, caseId, { agentId });
      setStatus({ kind: "info", text: s.reassigned });
      reload();
    } catch (error) {
      console.warn("staff: could not reassign", error);
      setStatus({ kind: "error", text: s.failed });
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setStatus({ kind: "busy" });
    try {
      const saved = await staffApi.updateSettings(identity, {
        timezone: settings.timezone,
        schedule: settings.schedule,
        attentionThresholdHours: settings.attentionThresholdHours,
        followUpWindowDays: settings.followUpWindowDays,
        emailDelayMinutes: settings.emailDelayMinutes,
        reminderAfterHours: settings.reminderAfterHours,
      });
      setSettings(saved);
      setStatus({ kind: "info", text: s.settingsSaved });
      reload();
    } catch (error) {
      console.warn("staff: could not save settings", error);
      setStatus({ kind: "error", text: error instanceof ApiError && error.status === 403 ? s.forbidden : s.failed });
    }
  }

  function setDay(day: Weekday, patch: { open?: string; close?: string } | null) {
    if (!settings) return;
    const current = settings.schedule[day];
    const next = patch === null ? null : { open: patch.open ?? current?.open ?? "09:00", close: patch.close ?? current?.close ?? "18:00" };
    setSettings({ ...settings, schedule: { ...settings.schedule, [day]: next } });
  }

  return (
    <section className={styles.panelPage} aria-label={s.title}>
      <header className={styles.panelHeader}>
        <h2 className={styles.caseTitle}>
          {s.title} <span className={styles.simBadge}>{t.app.simulationBadge}</span>
        </h2>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          {t.staff.savedReplies.back}
        </button>
      </header>
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

      {overview && (
        <>
          <h3 className={styles.contextTitle}>{s.demand}</h3>
          <dl className={styles.facts} data-testid="overview">
            <dt>{s.unassigned}</dt>
            <dd>
              {overview.unassigned.count}
              {overview.unassigned.oldestCreatedAt ? ` · ${fill(s.oldest, { age: formatDuration(overview.unassigned.oldestCreatedAt) })}` : ""}
            </dd>
            <dt>{s.awaitingReply}</dt>
            <dd>
              {overview.awaitingReply.count}
              {overview.awaitingReply.oldestSince ? ` · ${fill(s.oldest, { age: formatDuration(overview.awaitingReply.oldestSince) })}` : ""}
            </dd>
            {CASE_STATUSES.map((st) => (
              <div key={st} className={styles.recordFact}>
                <dt>{t.staff.status[st]}</dt>
                <dd>{overview.byStatus[st]}</dd>
              </div>
            ))}
          </dl>
          <h3 className={styles.contextTitle}>{s.byAgent}</h3>
          {overview.byAgent.length === 0 ? (
            <p className={styles.muted}>{s.noAgents}</p>
          ) : (
            <ul className={styles.replyList} data-testid="by-agent">
              {overview.byAgent.map((a) => (
                <li key={a.agentId} className={styles.replyItem}>
                  <strong>{SIMULATED_STAFF.find((x) => x.id === a.agentId)?.name ?? a.agentId}</strong> · {fill(s.agentLoad, { open: String(a.open), awaiting: String(a.awaitingReply) })}
                </li>
              ))}
            </ul>
          )}
          <h3 className={styles.contextTitle}>{fill(s.overdue, { hours: String(overview.attentionThresholdHours) })}</h3>
          {overview.overdue.length === 0 ? (
            <p className={styles.muted}>{s.noOverdue}</p>
          ) : (
            <ul className={styles.replyList} data-testid="overdue">
              {overview.overdue.map((c) => (
                <li key={c.id} className={styles.replyItem}>
                  <div className={styles.replyHead}>
                    <button type="button" className={styles.linkButton} onClick={() => onOpenCase(c.id)}>
                      {c.reference} · {c.subject}
                    </button>
                    <span className={styles.attention}>{fill(t.staff.awaitingReply, { age: formatDuration(c.awaitingReplySince ?? c.lastMessageAt) })}</span>
                  </div>
                  <p className={styles.consultationMeta}>
                    {t.staff.responsible}: {c.assignedAgentId ?? t.staff.unassigned}
                  </p>
                  <label className={styles.composerLabel}>
                    {s.reassignTo}
                    <select className={styles.select} value="" onChange={(event) => event.target.value && void reassign(c.id, event.target.value)} disabled={status.kind === "busy"}>
                      <option value="">—</option>
                      {SIMULATED_STAFF.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {metrics && (
        <>
          <h3 className={styles.contextTitle}>
            {s.metrics}{" "}
            <select className={styles.filterSelect} aria-label={s.period} value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 30)}>
              <option value={7}>{fill(s.days, { n: "7" })}</option>
              <option value={30}>{fill(s.days, { n: "30" })}</option>
            </select>
          </h3>
          <p className={styles.hint}>{s.metricsNote}</p>
          <dl className={styles.facts} data-testid="metrics">
            <dt>{s.created}</dt>
            <dd>{metrics.created}</dd>
            <dt>{s.resolved}</dt>
            <dd>{metrics.resolved}</dd>
            <dt>{s.closed}</dt>
            <dd>{metrics.closed}</dd>
            <dt>{s.reopened}</dt>
            <dd>
              {metrics.reopened}
              {metrics.reopenRate !== null ? ` (${Math.round(metrics.reopenRate * 100)}%)` : ""}
            </dd>
            <dt>{s.firstResponse}</dt>
            <dd>{fill(s.stats, { median: minutes(metrics.firstResponse.medianMinutes), p90: minutes(metrics.firstResponse.p90Minutes), n: String(metrics.firstResponse.count) })}</dd>
            <dt>{s.resolution}</dt>
            <dd>{fill(s.stats, { median: minutes(metrics.resolution.medianMinutes), p90: minutes(metrics.resolution.p90Minutes), n: String(metrics.resolution.count) })}</dd>
            <dt>{s.unansweredNow}</dt>
            <dd>
              {metrics.unansweredNow.count}
              {metrics.unansweredNow.oldestMinutes !== null ? ` · ${fill(s.oldest, { age: minutes(metrics.unansweredNow.oldestMinutes) })}` : ""}
            </dd>
          </dl>
        </>
      )}

      {settings && (
        <form className={styles.replyForm} onSubmit={saveSettings} aria-label={s.settings}>
          <h3 className={styles.contextTitle}>{s.settings}</h3>
          <p className={styles.hint}>
            {settings.workingDefault ? s.workingDefault : fill(s.configuredBy, { agent: settings.updatedByName ?? settings.updatedById ?? "", time: settings.updatedAt ? formatMessageTime(settings.updatedAt) : "" })}
          </p>
          <label className={styles.composerLabel} htmlFor="settings-timezone">
            {s.timezone}
          </label>
          <input id="settings-timezone" className={styles.searchInput} value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} />
          <ul className={styles.scheduleList}>
            {WEEKDAYS.map((day) => {
              const window = settings.schedule[day];
              return (
                <li key={day} className={styles.scheduleRow}>
                  <label className={styles.scheduleDay}>
                    <input type="checkbox" checked={window !== null} onChange={(event) => setDay(day, event.target.checked ? {} : null)} aria-label={fill(s.openOn, { day: s.weekdays[day] })} />
                    {s.weekdays[day]}
                  </label>
                  {window && (
                    <>
                      <input type="time" aria-label={fill(s.opensAt, { day: s.weekdays[day] })} value={window.open} onChange={(event) => setDay(day, { open: event.target.value })} />
                      <input type="time" aria-label={fill(s.closesAt, { day: s.weekdays[day] })} value={window.close} onChange={(event) => setDay(day, { close: event.target.value })} />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <label className={styles.composerLabel} htmlFor="settings-threshold">
            {s.threshold}
          </label>
          <input id="settings-threshold" type="number" min={1} max={720} className={styles.searchInput} value={settings.attentionThresholdHours} onChange={(event) => setSettings({ ...settings, attentionThresholdHours: Number(event.target.value) })} />
          <label className={styles.composerLabel} htmlFor="settings-window">
            {s.followUpWindow}
          </label>
          <input id="settings-window" type="number" min={1} max={90} className={styles.searchInput} value={settings.followUpWindowDays} onChange={(event) => setSettings({ ...settings, followUpWindowDays: Number(event.target.value) })} />
          <label className={styles.composerLabel} htmlFor="settings-email-delay">
            {s.emailDelay}
          </label>
          <input id="settings-email-delay" type="number" min={0} max={1440} className={styles.searchInput} value={settings.emailDelayMinutes} onChange={(event) => setSettings({ ...settings, emailDelayMinutes: Number(event.target.value) })} />
          <label className={styles.composerLabel} htmlFor="settings-reminder">
            {s.reminderAfter}
          </label>
          <input id="settings-reminder" type="number" min={1} max={720} className={styles.searchInput} value={settings.reminderAfterHours} onChange={(event) => setSettings({ ...settings, reminderAfterHours: Number(event.target.value) })} />
          <div className={styles.composerActions}>
            <button type="submit" className={styles.primaryButton} disabled={status.kind === "busy"}>
              {s.saveSettings}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
