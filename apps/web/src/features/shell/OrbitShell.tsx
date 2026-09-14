"use client";

import { useState } from "react";
import { SupportPanel } from "@/features/support/SupportPanel";
import { dictionary as t } from "@/i18n";
import { SIMULATED_CUSTOMERS, useSimulatedCustomer } from "@/lib/simulated-session";
import { useMediaQuery } from "@/lib/use-media-query";

/** Below this width the panel is a full-screen view toggled from the topbar (shell.module.css). */
const DESKTOP_QUERY = "(min-width: 900px)";
import styles from "./shell.module.css";

/** Simulated Orbit host (DEC-0003): trading placeholder + the "Suporte" entrypoint and side panel. */
export function OrbitShell() {
  const [customer, selectCustomer] = useSimulatedCustomer();
  const [panelOpen, setPanelOpen] = useState(false);
  const desktop = useMediaQuery(DESKTOP_QUERY);

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
              onChange={(event) => selectCustomer(event.target.value)}
              aria-label={t.shell.account}
            >
              {SIMULATED_CUSTOMERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
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
        <main className={styles.trading} aria-label={t.shell.tradingPlaceholder}>
          <h1 className={styles.tradingTitle}>{t.shell.tradingPlaceholder}</h1>
          <p className={styles.tradingHint}>{t.shell.tradingPlaceholderHint}</p>
          <p className={styles.simNote}>{t.app.simulationNote}</p>
        </main>

        <aside id="support-panel" className={styles.panel} aria-label={t.support.title}>
          {/* Keyed by customer: changing who the browser acts as never leaves another customer's conversation on screen (FND-0011). */}
          <SupportPanel key={customer.id} customer={customer} visible={desktop || panelOpen} onClose={() => setPanelOpen(false)} />
        </aside>
      </div>
    </div>
  );
}
