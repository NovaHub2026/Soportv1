"use client";

import type { DataExportRecord } from "@orbit-support/shared";
import { type FormEvent, useEffect, useState } from "react";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { ApiError } from "@/lib/api";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import styles from "./staff.module.css";

/** Hands the export to the browser as a JSON file (a viewer's download; nothing leaves the machine). */
function downloadJson(name: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Exports of a customer's support data on request (PH-10.3, DEC-0039 h): administrators only, each one recorded. */
export function DataExportSection({ identity }: { identity: StaffIdentity }) {
  const e = t.staff.supervision.exports;
  const [customerId, setCustomerId] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "info"; text: string } | { kind: "error"; text: string }>({ kind: "idle" });
  const [records, setRecords] = useState<DataExportRecord[] | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    staffApi
      .listDataExports(identity, controller.signal)
      .then(setRecords)
      .catch(() => {
        if (!controller.signal.aborted) setRecords([]);
      });
    return () => controller.abort();
  }, [identity, attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = customerId.trim();
    if (!id || reason.trim().length < 5) return;
    setStatus({ kind: "busy" });
    try {
      const result = await staffApi.exportCustomer(identity, id, { reason: reason.trim() });
      downloadJson(`orbit-support-${id}-${result.record.id}.json`, result);
      setStatus({ kind: "info", text: fill(e.done, { id: result.record.id.slice(0, 8), count: String(result.record.caseCount), customer: id }) });
      setReason("");
      setAttempt((n) => n + 1);
    } catch (error) {
      console.warn("staff: could not export", error);
      setStatus({ kind: "error", text: error instanceof ApiError && error.status === 403 ? e.forbidden : e.failed });
    }
  }

  return (
    <section aria-label={e.title} data-testid="data-export">
      <h3 className={styles.contextTitle}>{e.title}</h3>
      <p className={styles.hint}>{e.hint}</p>
      <form className={styles.replyForm} onSubmit={(event) => void submit(event)}>
        <label className={styles.composerLabel} htmlFor="export-customer">
          {e.customerId}
        </label>
        <input id="export-customer" className={styles.searchInput} value={customerId} onChange={(event) => setCustomerId(event.target.value)} maxLength={64} />
        <label className={styles.composerLabel} htmlFor="export-reason">
          {e.reason}
        </label>
        <input id="export-reason" className={styles.searchInput} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
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
        <div className={styles.composerActions}>
          <button type="submit" className={styles.primaryButton} disabled={status.kind === "busy" || !customerId.trim() || reason.trim().length < 5}>
            {status.kind === "busy" ? e.exporting : e.submit}
          </button>
        </div>
      </form>
      <h4 className={styles.contextTitle}>{e.recent}</h4>
      {records === null ? null : records.length === 0 ? (
        <p className={styles.muted}>{e.none}</p>
      ) : (
        <ul className={styles.replyList} data-testid="data-export-records">
          {records.map((r) => (
            <li key={r.id} className={styles.replyItem}>
              {fill(e.recordLine, { time: formatMessageTime(r.createdAt), customer: r.customerId, count: String(r.caseCount), agent: r.requestedByName ?? r.requestedById, reason: r.reason })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
