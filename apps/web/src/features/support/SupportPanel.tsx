"use client";

import { useMemo, useState } from "react";
import { dictionary as t } from "@/i18n";
import type { CustomerIdentity } from "@/lib/api";
import type { SimulatedCustomer } from "@/lib/simulated-session";
import { CaseConversation } from "./CaseConversation";
import { NewRequestForm } from "./NewRequestForm";
import { SupportHome } from "./SupportHome";
import styles from "./support.module.css";

type View = { name: "home" } | { name: "new" } | { name: "case"; caseId: string };

interface SupportPanelProps {
  customer: SimulatedCustomer;
  onClose?: () => void;
}

/**
 * The customer "Suporte" experience (context §4): home with a prominent way to talk to a person, a short
 * new-request form, and the conversation of one case. Opening the panel creates nothing; sending does.
 */
export function SupportPanel({ customer, onClose }: SupportPanelProps) {
  const [view, setView] = useState<View>({ name: "home" });
  const identity = useMemo<CustomerIdentity>(() => ({ customerId: customer.id }), [customer.id]);

  return (
    <section className={styles.panel} data-testid="support-panel">
      <header className={styles.header}>
        {view.name !== "home" ? (
          <button type="button" className={styles.backButton} onClick={() => setView({ name: "home" })}>
            ← {t.support.back}
          </button>
        ) : (
          <span className={styles.headerSpacer} />
        )}
        <h2 className={styles.title}>{t.support.title}</h2>
        {onClose ? (
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t.shell.closeSupport}>
            ×
          </button>
        ) : (
          <span className={styles.headerSpacer} />
        )}
      </header>

      <div className={styles.simulationStrip} role="note">
        <span className={styles.simBadge}>{t.app.simulationBadge}</span> {customer.name}
      </div>

      {view.name === "home" && (
        <SupportHome
          identity={identity}
          onNewRequest={() => setView({ name: "new" })}
          onOpenCase={(caseId) => setView({ name: "case", caseId })}
        />
      )}
      {view.name === "new" && (
        <NewRequestForm identity={identity} onCreated={(created) => setView({ name: "case", caseId: created.id })} />
      )}
      {view.name === "case" && (
        <CaseConversation key={view.caseId} identity={identity} caseId={view.caseId} onOpenCase={(caseId) => setView({ name: "case", caseId })} />
      )}
    </section>
  );
}
