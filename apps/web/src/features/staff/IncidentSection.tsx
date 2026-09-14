"use client";

import type { Incident, StaffCaseDetail } from "@orbit-support/shared";
import { type FormEvent, useEffect, useState } from "react";
import { dictionary as t, fill } from "@/i18n";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import styles from "./staff.module.css";

interface IncidentSectionProps {
  identity: StaffIdentity;
  detail: StaffCaseDetail;
  /** Called after any change so the case view re-reads. */
  onChanged: () => void;
}

type Mode = "idle" | "link" | "create";

/**
 * Shared incidents (context §5.4): associate this case with an open incident, send one internal note to all
 * linked cases, mark the incident resolved. Conversations stay separate; nothing here resolves a case.
 */
export function IncidentSection({ identity, detail, onChanged }: IncidentSectionProps) {
  const c = t.staff.incidents;
  const [mode, setMode] = useState<Mode>("idle");
  const [openIncidents, setOpenIncidents] = useState<Incident[]>([]);
  const [chosen, setChosen] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "info"; text: string } | { kind: "error"; text: string }>({ kind: "idle" });
  const [linkedIncident, setLinkedIncident] = useState<Incident | null>(null);

  // Open incidents for the picker, and the linked incident's current state (status, linked count).
  useEffect(() => {
    const controller = new AbortController();
    staffApi
      .listIncidents(identity, undefined, controller.signal)
      .then((all) => {
        setOpenIncidents(all.filter((i) => i.status === "open"));
        setLinkedIncident(all.find((i) => i.id === detail.incidentId) ?? null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.warn("staff: could not load incidents", error);
      });
    return () => controller.abort();
  }, [identity, detail.incidentId, detail.updatedAt]);

  async function run(action: () => Promise<unknown>, info?: (result: unknown) => string) {
    setStatus({ kind: "busy" });
    try {
      const result = await action();
      setStatus(info ? { kind: "info", text: info(result) } : { kind: "idle" });
      setMode("idle");
      onChanged();
    } catch (error) {
      console.warn("staff: incident action failed", error);
      setStatus({ kind: "error", text: c.failed });
    }
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (title.length < 3) return;
    void run(async () => {
      const incident = await staffApi.createIncident(identity, { title });
      await staffApi.linkIncident(identity, detail.id, incident.id);
      setNewTitle("");
    });
  }

  function handleLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) return;
    void run(() => staffApi.linkIncident(identity, detail.id, chosen));
  }

  function handleBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = note.trim();
    if (!body || !detail.incidentId) return;
    void run(
      async () => {
        const result = await staffApi.broadcastIncidentNote(identity, detail.incidentId!, { body });
        setNote("");
        return result;
      },
      (result) => fill(c.delivered, { n: String((result as { delivered: number }).delivered) }),
    );
  }

  const busy = status.kind === "busy";

  return (
    <section className={styles.incidentSection} aria-label={c.title}>
      <h3 className={styles.contextTitle}>{c.title}</h3>
      {detail.incidentId ? (
        <div className={styles.incidentCard} data-status={linkedIncident?.status ?? "open"}>
          <div className={styles.consultationHead}>
            <strong>{detail.incidentTitle ?? linkedIncident?.title}</strong>
            <span className={styles.consultationStatus}>{linkedIncident?.status === "resolved" ? c.statusResolved : c.statusOpen}</span>
          </div>
          {linkedIncident && <p className={styles.consultationMeta}>{fill(c.linkedCount, { n: String(linkedIncident.linkedCaseCount) })}</p>}
          {linkedIncident?.status !== "resolved" && (
            <form className={styles.answerForm} onSubmit={handleBroadcast}>
              <label className="visually-hidden" htmlFor="incident-note">
                {c.broadcastLabel}
              </label>
              <textarea id="incident-note" className={styles.composerInput} rows={2} maxLength={5000} placeholder={c.broadcastLabel} value={note} onChange={(event) => setNote(event.target.value)} />
              <div className={styles.composerActions}>
                <button type="submit" className={styles.secondaryButton} disabled={!note.trim() || busy}>
                  {c.broadcastSubmit}
                </button>
              </div>
            </form>
          )}
          <div className={styles.actions}>
            {linkedIncident?.status !== "resolved" && (
              <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void run(() => staffApi.resolveIncident(identity, detail.incidentId!))} title={c.resolveHint}>
                {c.resolve}
              </button>
            )}
            <button type="button" className={styles.linkButton} disabled={busy} onClick={() => void run(() => staffApi.linkIncident(identity, detail.id, null))}>
              {c.unlink}
            </button>
          </div>
          <p className={styles.consultationMeta}>{c.resolveHint}</p>
        </div>
      ) : (
        <>
          <p className={styles.consultationMeta}>{c.none}</p>
          {mode === "idle" && (
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setMode("link")}>
                {c.link}
              </button>
              <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setMode("create")}>
                {c.create}
              </button>
            </div>
          )}
          {mode === "link" && (
            <form className={styles.answerForm} onSubmit={handleLink} aria-label={c.link}>
              <label className={styles.composerLabel} htmlFor="incident-choice">
                {c.existing}
              </label>
              <select id="incident-choice" className={styles.select} value={chosen} onChange={(event) => setChosen(event.target.value)}>
                <option value="">{c.choose}</option>
                {openIncidents.map((incident) => (
                  <option key={incident.id} value={incident.id}>
                    {incident.title} · {fill(c.linkedCount, { n: String(incident.linkedCaseCount) })}
                  </option>
                ))}
              </select>
              <div className={styles.composerActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setMode("idle")}>
                  {c.cancel}
                </button>
                <button type="submit" className={styles.primaryButton} disabled={!chosen || busy}>
                  {c.confirmLink}
                </button>
              </div>
            </form>
          )}
          {mode === "create" && (
            <form className={styles.answerForm} onSubmit={handleCreate} aria-label={c.create}>
              <label className={styles.composerLabel} htmlFor="incident-title">
                {c.newTitle}
              </label>
              <input id="incident-title" className={styles.composerInput} maxLength={200} placeholder={c.newTitlePlaceholder} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
              <div className={styles.composerActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setMode("idle")}>
                  {c.cancel}
                </button>
                <button type="submit" className={styles.primaryButton} disabled={newTitle.trim().length < 3 || busy}>
                  {c.confirmCreate}
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {status.kind === "info" && (
        <p className={styles.consultationMeta} role="status">
          {status.text}
        </p>
      )}
      {status.kind === "error" && (
        <p className={styles.errorText} role="alert">
          {status.text}
        </p>
      )}
    </section>
  );
}
