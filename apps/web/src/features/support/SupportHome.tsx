"use client";

import { type CaseSummary, OPEN_CASE_STATUSES } from "@orbit-support/shared";
import { useCallback, useEffect, useState } from "react";
import { dictionary as t, formatMessageTime } from "@/i18n";
import { type CustomerIdentity, customerApi } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import styles from "./support.module.css";

interface SupportHomeProps {
  identity: CustomerIdentity;
  onNewRequest: () => void;
  onOpenCase: (caseId: string) => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; cases: CaseSummary[] };

export function SupportHome({ identity, onNewRequest, onOpenCase }: SupportHomeProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    customerApi
      .listCases(identity, controller.signal)
      .then((cases) => setState({ status: "ready", cases }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("support: could not load cases", error);
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [identity.customerId, attempt]); // eslint-disable-line react-hooks/exhaustive-deps -- identity is keyed by customerId

  const active = state.status === "ready" ? state.cases.filter((c) => OPEN_CASE_STATUSES.includes(c.status)) : [];
  const previous = state.status === "ready" ? state.cases.filter((c) => !OPEN_CASE_STATUSES.includes(c.status)) : [];

  return (
    <div className={styles.body}>
      <p className={styles.availability}>{t.support.home.availability}</p>
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

function CaseList({ title, cases, onOpenCase }: { title: string; cases: CaseSummary[]; onOpenCase: (id: string) => void }) {
  return (
    <section className={styles.listSection}>
      <h3 className={styles.listTitle}>{title}</h3>
      <ul className={styles.caseList}>
        {cases.map((c) => (
          <li key={c.id}>
            <button type="button" className={styles.caseItem} onClick={() => onOpenCase(c.id)}>
              <span className={styles.caseItemTop}>
                <span className={styles.caseSubject}>{c.subject}</span>
                <StatusBadge status={c.status} />
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
