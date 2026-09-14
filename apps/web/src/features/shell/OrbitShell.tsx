"use client";

import type { OrbitLookup, OrbitRecordListItem } from "@orbit-support/shared";
import { useEffect, useMemo, useState } from "react";
import { type SupportEntry, SupportPanel } from "@/features/support/SupportPanel";
import { dictionary as t, formatMessageTime } from "@/i18n";
import { customerApi } from "@/lib/api";
import { SIMULATED_CUSTOMERS, useSimulatedCustomer } from "@/lib/simulated-session";
import { useMediaQuery } from "@/lib/use-media-query";
import { AccessRecoveryForm } from "@/features/access/AccessRecoveryForm";
import { NotificationsBell } from "./NotificationsBell";

/** Below this width the panel is a full-screen view toggled from the topbar (shell.module.css). */
const DESKTOP_QUERY = "(min-width: 900px)";
import styles from "./shell.module.css";

/** Simulated Orbit host (DEC-0003): trading placeholder + the "Suporte" entrypoint and side panel. */
export function OrbitShell() {
  const [customer, selectCustomer] = useSimulatedCustomer();
  const [panelOpen, setPanelOpen] = useState(false);
  // "Não consigo acessar minha conta" (PH-7.1): reachable without choosing or having any session.
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [entry, setEntry] = useState<SupportEntry | null>(null);
  const [openCase, setOpenCase] = useState<{ caseId: string; seq: number; customerId: string } | null>(null);
  const openFromNotification = (caseId: string) => {
    setOpenCase((current) => ({ caseId, seq: (current?.seq ?? 0) + 1, customerId: customer.id }));
    setPanelOpen(true);
  };
  // Stable per customer: a new object on every render made the bell re-subscribe its stream each time (FND-0034).
  const identity = useMemo(() => ({ customerId: customer.id }), [customer.id]);
  // Records are remembered with their owner so another customer's list is never shown while the new one loads (FND-0055).
  const [recordsFor, setRecordsFor] = useState<{ customerId: string; lookup: OrbitLookup<OrbitRecordListItem[]> } | null>(null);
  const records = recordsFor?.customerId === customer.id ? recordsFor.lookup : null;

  // The simulated "trading" area lists the customer's records so "Preciso de ajuda" can start from one (§4.2).
  useEffect(() => {
    const controller = new AbortController();
    const customerId = customer.id;
    customerApi
      .listRecords({ customerId }, controller.signal)
      .then(({ records: lookup }) => setRecordsFor({ customerId, lookup: lookup && (lookup.state === "available" || lookup.state === "unavailable") ? lookup : { state: "unavailable", reason: "unavailable", source: "simulated", fetchedAt: new Date().toISOString() } }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("shell: could not load records", error);
          setRecordsFor({ customerId, lookup: { state: "unavailable", reason: "unavailable", source: "simulated", fetchedAt: new Date().toISOString() } });
        }
      });
    return () => controller.abort();
  }, [customer.id, panelOpen]);

  const askAbout = (record: OrbitRecordListItem) => {
    setEntry((current) => ({ record, seq: (current?.seq ?? 0) + 1, customerId: customer.id }));
    setPanelOpen(true);
  };

  return (
    <div className={styles.shell} data-panel-open={panelOpen ? "true" : "false"}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          {t.shell.brand}
        </div>
        <div className={styles.topbarRight}>
          <label className={styles.accountPicker}>
            <span className={styles.simBadge}>{t.app.simulationBadge}</span>
            <span className="visually-hidden">{t.shell.account}</span>
            <select
              className={styles.accountSelect}
              value={customer.id}
              onChange={(event) => {
                // A new identity starts clean: no pending contextual entry or notification open from the previous one (FND-0029).
                setEntry(null);
                setOpenCase(null);
                selectCustomer(event.target.value);
              }}
              aria-label={t.shell.account}
            >
              {SIMULATED_CUSTOMERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {/* Keyed by customer: a new identity starts with an empty bell, never the previous customer's notifications (FND-0035). */}
          <button type="button" className={styles.recoveryLink} onClick={() => setRecoveryOpen(true)} aria-pressed={recoveryOpen}>
            {t.access.link}
          </button>
          <NotificationsBell key={customer.id} identity={identity} onOpenCase={openFromNotification} refreshToken={openCase?.seq ?? 0} />
          <button
            type="button"
            className={styles.supportButton}
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            aria-controls="support-panel"
          >
            {panelOpen ? t.shell.closeSupport : t.shell.openSupport}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <main className={styles.trading} aria-label={recoveryOpen ? t.access.title : t.shell.tradingPlaceholder}>
          {recoveryOpen && <AccessRecoveryForm onClose={() => setRecoveryOpen(false)} />}
          {!recoveryOpen && (
            <>
          <h1 className={styles.tradingTitle}>{t.shell.tradingPlaceholder}</h1>
          <p className={styles.tradingHint}>{t.shell.tradingPlaceholderHint}</p>
          <p className={styles.simNote}>{t.app.simulationNote}</p>

          <section className={styles.records} aria-label={t.support.records.title}>
            <h2 className={styles.recordsTitle}>
              {t.support.records.title} <span className={styles.simBadge}>{t.app.simulationBadge}</span>
            </h2>
            <p className={styles.tradingHint}>{t.support.records.hint}</p>
            {records === null && <p className={styles.tradingHint}>{t.support.records.loading}</p>}
            {records?.state === "unavailable" && (
              <p className={styles.tradingHint} role="note">
                {t.support.records.unavailable}
              </p>
            )}
            {records?.state === "available" && records.data.length === 0 && <p className={styles.tradingHint}>{t.support.records.empty}</p>}
            {records?.state === "available" && records.data.length > 0 && (
              <ul className={styles.recordList}>
                {records.data.map((record) => (
                  <li key={`${record.kind}:${record.reference}`} className={styles.recordItem}>
                    <div>
                      <p className={styles.recordItemTitle}>
                        {t.support.records.kinds[record.kind]} · {record.title}
                      </p>
                      <p className={styles.tradingHint}>
                        {record.reference} · {record.status} · {formatMessageTime(record.occurredAt)}
                      </p>
                    </div>
                    <button type="button" className={styles.helpButton} onClick={() => askAbout(record)} aria-label={`${t.support.records.help}: ${record.title}`}>
                      {t.support.records.help}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
            </>
          )}
        </main>

        <aside id="support-panel" className={styles.panel} aria-label={t.support.title}>
          {/* Keyed by customer: changing who the browser acts as never leaves another customer's conversation on screen (FND-0011). */}
          <SupportPanel key={customer.id} customer={customer} visible={desktop || panelOpen} entry={entry} openCase={openCase} onClose={() => setPanelOpen(false)} />
        </aside>
      </div>
    </div>
  );
}
