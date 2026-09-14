"use client";

import type { OrbitRecord, OrbitRecordKind, OrbitUnavailableReason } from "@orbit-support/shared";
import type { ReactNode } from "react";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import styles from "./support.module.css";

export interface RecordCardProps {
  kind: OrbitRecordKind;
  reference: string;
  /** What the record looked like — null when the adapter could not answer (then `lookupReason` says why). */
  snapshot: OrbitRecord | null;
  lookupReason?: OrbitUnavailableReason | null;
  /** When the snapshot was captured (a case card) — omitted for a live selection card. */
  capturedAt?: string;
  /** Show the fact list (staff, conversation) or only the headline (selection, lists). */
  detailed?: boolean;
  actions?: ReactNode;
  testId?: string;
}

/**
 * The recognizable card of an Orbit record a request is about (context §4.2). Customers and staff see the same
 * masked facts; a missing snapshot is shown as such, never as an assumed state (RULE-SUP-07, §14 item 7).
 */
export function RecordCard({ kind, reference, snapshot, lookupReason = null, capturedAt, detailed = false, actions, testId }: RecordCardProps) {
  const r = t.support.records;
  return (
    <article className={styles.recordCard} data-kind={kind} data-testid={testId}>
      <header className={styles.recordCardHead}>
        <span className={styles.recordKind}>{r.kinds[kind]}</span>
        <span className={styles.recordReference}>{reference}</span>
      </header>
      {snapshot ? (
        <>
          <p className={styles.recordTitle}>
            {snapshot.title}
            <span className={styles.recordStatus}> · {snapshot.status}</span>
          </p>
          <p className={styles.recordMeta}>
            {formatMessageTime(snapshot.occurredAt)}
            {snapshot.amount && snapshot.currency ? ` · ${snapshot.amount} ${snapshot.currency}` : ""}
            {capturedAt ? ` · ${fill(r.snapshotAt, { time: formatMessageTime(capturedAt) })}` : ""}
          </p>
          {detailed && snapshot.facts.length > 0 && (
            <dl className={styles.recordFacts}>
              {snapshot.facts.map((fact) => (
                <div key={fact.label} className={styles.recordFact}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      ) : (
        <p className={styles.recordMissing} role="note">
          {lookupReason === "not_found" ? r.notFound : r.unavailableAtOpen}
          {capturedAt ? ` (${formatMessageTime(capturedAt)})` : ""}
        </p>
      )}
      {actions && <div className={styles.recordActions}>{actions}</div>}
    </article>
  );
}
