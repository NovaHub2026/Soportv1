"use client";

import type { OrbitRecordListItem } from "@orbit-support/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { dictionary as t } from "@/i18n";
import type { CustomerIdentity } from "@/lib/api";
import { CaseConversation } from "./CaseConversation";
import { NewRequestForm } from "./NewRequestForm";
import { SupportHome } from "./SupportHome";
import styles from "./support.module.css";

type View = { name: "home" } | { name: "new"; record?: OrbitRecordListItem | null } | { name: "case"; caseId: string };

/** A "Preciso de ajuda" request from the host: the record plus a sequence so the same record can be asked twice. */
export interface SupportEntry {
  record: OrbitRecordListItem;
  seq: number;
  /** The customer the record belongs to: an entry never carries over to another identity (FND-0029). */
  customerId: string;
}

/** The person the panel serves: a simulated pick (labeled) or the broker's real customer (bearer, no label). */
export interface PanelCustomer {
  id: string;
  name: string;
  /** The broker's access token when the panel runs inside the broker's app (PH-13.2); absent = simulated headers. */
  bearer?: string;
}

interface SupportPanelProps {
  customer: PanelCustomer;
  onClose?: () => void;
  /** Whether the panel is actually on screen (the mobile layout hides it while mounted). Drives read receipts (FND-0021). */
  visible?: boolean;
  /** Contextual entry from a record in the host (context §4.2). */
  entry?: SupportEntry | null;
  /** A case the host wants opened (a notification was clicked — PH-6.1). */
  openCase?: { caseId: string; seq: number; customerId: string } | null;
}

/**
 * The customer "Suporte" experience (context §4): home with a prominent way to talk to a person, a short
 * new-request form, and the conversation of one case. Opening the panel creates nothing; sending does.
 */
export function SupportPanel({ customer, onClose, visible = true, entry = null, openCase = null }: SupportPanelProps) {
  const [view, setView] = useState<View>({ name: "home" });
  // "Voltar" removes itself from the DOM: focus moves to the panel title instead of falling to <body> (BL-024).
  const titleRef = useRef<HTMLHeadingElement>(null);
  const goHome = () => {
    setView({ name: "home" });
    requestAnimationFrame(() => titleRef.current?.focus());
  };
  const identity = useMemo<CustomerIdentity>(() => (customer.bearer ? { customerId: customer.id, bearer: customer.bearer } : { customerId: customer.id }), [customer.id, customer.bearer]);

  // "Preciso de ajuda" on a record opens the new-request form about it.
  useEffect(() => {
    if (entry && entry.customerId === customer.id) queueMicrotask(() => setView({ name: "new", record: entry.record }));
  }, [entry, customer.id]);
  useEffect(() => {
    if (openCase && openCase.customerId === customer.id) queueMicrotask(() => setView({ name: "case", caseId: openCase.caseId }));
  }, [openCase, customer.id]);

  return (
    <section className={styles.panel} data-testid="support-panel">
      <header className={styles.header}>
        {view.name !== "home" ? (
          <button type="button" className={styles.backButton} onClick={goHome}>
            ← {t.support.back}
          </button>
        ) : (
          <span className={styles.headerSpacer} />
        )}
        <h2 className={styles.title} ref={titleRef} tabIndex={-1}>
          {t.support.title}
        </h2>
        {onClose ? (
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t.shell.closeSupport}>
            ×
          </button>
        ) : (
          <span className={styles.headerSpacer} />
        )}
      </header>

      {/* The simulation label exists only for simulated identities (DEC-0003); a real session shows none. */}
      {!customer.bearer && (
        <div className={styles.simulationStrip} role="note">
          <span className={styles.simBadge}>{t.app.simulationBadge}</span> {customer.name}
        </div>
      )}

      {view.name === "home" && (
        <SupportHome
          identity={identity}
          onNewRequest={() => setView({ name: "new" })}
          onOpenCase={(caseId) => setView({ name: "case", caseId })}
        />
      )}
      {view.name === "new" && (
        <NewRequestForm
          key={view.record ? `${view.record.kind}:${view.record.reference}:${entry?.seq ?? 0}` : "general"}
          identity={identity}
          record={view.record ?? null}
          onOpenCase={(caseId) => setView({ name: "case", caseId })}
          onCreated={(created) => setView({ name: "case", caseId: created.id })}
        />
      )}
      {view.name === "case" && (
        <CaseConversation key={view.caseId} identity={identity} caseId={view.caseId} visible={visible} onOpenCase={(caseId) => setView({ name: "case", caseId })} />
      )}
    </section>
  );
}
