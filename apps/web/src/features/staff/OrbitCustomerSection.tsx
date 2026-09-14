"use client";

import type { OrbitCaseContext, OrbitCustomerSummary } from "@orbit-support/shared";
import { useCallback, useEffect, useState } from "react";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import styles from "./staff.module.css";

interface OrbitCustomerSectionProps {
  identity: StaffIdentity;
  caseId: string;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; context: OrbitCaseContext };

/**
 * The customer's Orbit summary for the open case (PH-4.1, context §6.1). Each lookup is shown as available or
 * explicitly unavailable with its reason — never as an assumed value (RULE-SUP-07) — and labeled as simulation
 * while the adapter is the simulated one (DEC-0003).
 */
export function OrbitCustomerSection({ identity, caseId }: OrbitCustomerSectionProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  const o = t.staff.orbit;

  useEffect(() => {
    const controller = new AbortController();
    staffApi
      .getOrbitContext(identity, caseId, controller.signal)
      .then((context) => {
        const customerState = context?.customer?.state;
        if (customerState !== "available" && customerState !== "unavailable") throw new Error("malformed Orbit context");
        setState({ status: "ready", context });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("staff: could not load Orbit context", error);
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [identity, caseId, attempt]);

  return (
    <section aria-label={o.title}>
      <h3 className={styles.contextTitle}>
        {o.title} <span className={styles.simBadge}>{t.app.simulationBadge}</span>
      </h3>
      {state.status === "loading" && (
        <p className={styles.consultationMeta} role="status">
          {o.loading}
        </p>
      )}
      {state.status === "error" && (
        <p className={styles.unavailable} role="note">
          {fill(o.unavailable, { reason: o.reasons.unavailable })}{" "}
          <button type="button" className={styles.linkButton} onClick={retry}>
            {o.retry}
          </button>
        </p>
      )}
      {state.status === "ready" && state.context.customer.state === "unavailable" && (
        <p className={styles.unavailable} role="note">
          {fill(o.unavailable, { reason: o.reasons[state.context.customer.reason] })}{" "}
          <button type="button" className={styles.linkButton} onClick={retry}>
            {o.retry}
          </button>
        </p>
      )}
      {state.status === "ready" && state.context.customer.state === "available" && (
        <CustomerFacts summary={state.context.customer.data} fetchedAt={state.context.customer.fetchedAt} />
      )}
      {state.status === "ready" && state.context.record && (
        <div data-testid="orbit-record-current">
          <h4 className={styles.contextTitle}>{o.record.current}</h4>
          {state.context.record.state === "available" ? (
            <dl className={styles.facts}>
              <dt>{o.record.title}</dt>
              <dd>
                {state.context.record.data.title} · <strong>{state.context.record.data.status}</strong>
              </dd>
              <dt>{o.fetchedAt}</dt>
              <dd>{formatMessageTime(state.context.record.fetchedAt)}</dd>
            </dl>
          ) : (
            <p className={styles.unavailable} role="note">
              {fill(o.record.unavailable, { reason: o.reasons[state.context.record.reason] })}
            </p>
          )}
        </div>
      )}
      {/* Subjects the boundary does not serve yet are listed as unavailable — never as an empty or zero value (RULE-SUP-07). */}
      <div data-testid="orbit-not-integrated">
        <h4 className={styles.contextTitle}>{o.notIntegratedTitle}</h4>
        <p className={styles.consultationMeta}>{o.notIntegratedHint}</p>
        <ul className={styles.notIntegratedList}>
          {o.notIntegrated.map((subject) => (
            <li key={subject}>
              {subject} · <span className={styles.consultationMeta}>{o.reasons.not_integrated}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CustomerFacts({ summary, fetchedAt }: { summary: OrbitCustomerSummary; fetchedAt: string }) {
  const o = t.staff.orbit;
  const dash = t.staff.context.none;
  return (
    <dl className={styles.facts} data-testid="orbit-customer">
      <dt>{o.username}</dt>
      <dd>{summary.username}</dd>
      <dt>{o.accountStatus}</dt>
      <dd>{o.accountStatuses[summary.accountStatus]}</dd>
      <dt>{o.environment}</dt>
      <dd>{o.environments[summary.environment]}</dd>
      <dt>{o.verification}</dt>
      <dd>
        {o.verificationStatuses[summary.verificationStatus]}
        {summary.verificationNextAction && <span className={styles.consultationMeta}> · {summary.verificationNextAction}</span>}
      </dd>
      <dt>{o.language}</dt>
      <dd>
        {summary.language} · {summary.country}
      </dd>
      <dt>{o.registeredAt}</dt>
      <dd>{formatMessageTime(summary.registeredAt)}</dd>
      <dt>{o.email}</dt>
      <dd>{summary.emailMasked ?? dash}</dd>
      <dt>{o.phone}</dt>
      <dd>{summary.phoneMasked ?? dash}</dd>
      <dt>{o.fetchedAt}</dt>
      <dd>{formatMessageTime(fetchedAt)}</dd>
    </dl>
  );
}
