"use client";

import { isStreamEvent, type StaffQueueView } from "@orbit-support/shared";
import { useEffect, useMemo, useState } from "react";
import { ConnectionIndicator } from "@/features/support/ConnectionIndicator";
import { dictionary as t } from "@/i18n";
import { SIMULATED_STAFF, useSimulatedStaff } from "@/lib/simulated-session";
import { type StreamStatus, subscribeStream } from "@/lib/sse";
import { type StaffIdentity, staffIdentityHeaders } from "@/lib/staff-api";
import { AccessRecoveryPanel } from "./AccessRecoveryPanel";
import { SavedRepliesPanel } from "./SavedRepliesPanel";
import { StaffCaseView } from "./StaffCaseView";
import { SupervisionPanel } from "./SupervisionPanel";
import { StaffQueue } from "./StaffQueue";
import styles from "./staff.module.css";

/** A change on one case, as announced by the staff stream; consumers compare `seq` to react once. */
export interface CaseSignal {
  caseId: string;
  seq: number;
}

/**
 * Three working areas (context §5.1): queues, conversation, customer/case context. Actions that change a
 * case bump `refreshToken` so the queue reflects them without waiting for its poll.
 */
export function StaffWorkspace() {
  const [staff, selectStaff, signOut] = useSimulatedStaff();
  // Not known yet (server render, first client render): nothing identity-bound (Cycle Audit 3).
  if (staff === undefined) {
    return (
      <div className={styles.workspace} data-pending="true" aria-busy="true">
        <p className={styles.muted}>{t.staff.loading}</p>
      </div>
    );
  }
  if (staff === null) return <StaffSignedOut onEnter={selectStaff} />;
  return <StaffWorkspaceFor staff={staff} selectStaff={selectStaff} signOut={signOut} />;
}

/** Neutral picker after "Sair" (PH-7.3): nothing of the previous agent is mounted. */
function StaffSignedOut({ onEnter }: { onEnter: (id: string) => void }) {
  const [choice, setChoice] = useState(SIMULATED_STAFF[0].id);
  return (
    <div className={styles.workspace} data-signed-out="true">
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          {t.shell.brand} · {t.staff.workspace}
        </div>
      </header>
      <section className={styles.signedOut} aria-label={t.staff.signedOut.title} data-testid="staff-signed-out">
        <h2 className={styles.caseTitle}>{t.staff.signedOut.title}</h2>
        <p className={styles.hint}>{t.staff.signedOut.hint}</p>
        <label className={styles.agentPicker}>
          <span className={styles.simBadge}>{t.app.simulationBadge}</span>
          <span className="visually-hidden">{t.staff.agentPicker}</span>
          <select className={styles.agentSelect} value={choice} onChange={(event) => setChoice(event.target.value)} aria-label={t.staff.agentPicker}>
            {SIMULATED_STAFF.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {t.staff.roles[s.role]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.primaryButton} onClick={() => onEnter(choice)}>
          {t.staff.signedOut.enter}
        </button>
      </section>
    </div>
  );
}

function StaffWorkspaceFor({ staff, selectStaff, signOut }: { staff: { id: string; name: string; role: StaffIdentity["role"] }; selectStaff: (id: string) => void; signOut: () => void }) {
  const [view, setView] = useState<StaffQueueView>("unassigned");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [caseSignal, setCaseSignal] = useState<CaseSignal | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [page, setPage] = useState<"cases" | "replies" | "supervision" | "recovery">("cases");
  const identity = useMemo<StaffIdentity>(
    () => ({ staffId: staff.id, displayName: staff.name, role: staff.role }),
    [staff.id, staff.name, staff.role],
  );

  // One staff stream per workspace (ADR-0004): every case change refreshes the queue and the open case.
  useEffect(() => {
    let seq = 0;
    const stop = subscribeStream("/staff/cases/stream", staffIdentityHeaders(identity), {
      onEvent: (_type, data) => {
        if (!isStreamEvent(data) || data.type === "heartbeat") return;
        seq += 1;
        setRefreshToken((n) => n + 1);
        setCaseSignal({ caseId: data.caseId, seq });
      },
      onStatus: (status) => {
        setStreamStatus(status);
        if (status === "connected") setRefreshToken((n) => n + 1);
      },
    });
    return stop;
  }, [identity]);

  return (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          {t.shell.brand} · {t.staff.workspace}
        </div>
        <div className={styles.topbarRight}>
          <ConnectionIndicator status={streamStatus} labels={t.staff.connection} />
          <button type="button" className={styles.secondaryButton} onClick={() => setPage(page === "replies" ? "cases" : "replies")} aria-pressed={page === "replies"}>
            {t.staff.savedReplies.open}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => setPage(page === "recovery" ? "cases" : "recovery")} aria-pressed={page === "recovery"}>
            {t.staff.accessRecovery.open}
          </button>
          {identity.role !== "agent" && (
            <button type="button" className={styles.secondaryButton} onClick={() => setPage(page === "supervision" ? "cases" : "supervision")} aria-pressed={page === "supervision"}>
              {t.staff.supervision.open}
            </button>
          )}
          <button type="button" className={styles.secondaryButton} onClick={signOut}>
            {t.staff.signOut}
          </button>
          <label className={styles.agentPicker}>
            <span className={styles.simBadge}>{t.app.simulationBadge}</span>
            <span className="visually-hidden">{t.staff.agentPicker}</span>
            <select
              className={styles.agentSelect}
              value={staff.id}
              onChange={(event) => selectStaff(event.target.value)}
              aria-label={t.staff.agentPicker}
            >
              {SIMULATED_STAFF.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {t.staff.roles[s.role]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {page === "replies" && <SavedRepliesPanel identity={identity} onClose={() => setPage("cases")} />}
      {page === "recovery" && <AccessRecoveryPanel identity={identity} onClose={() => setPage("cases")} />}
      {page === "supervision" && (
        <SupervisionPanel
          identity={identity}
          onClose={() => setPage("cases")}
          onOpenCase={(caseId) => {
            setSelectedCaseId(caseId);
            setPage("cases");
          }}
        />
      )}
      <div className={styles.columns} hidden={page !== "cases"}>
        <StaffQueue
          identity={identity}
          view={view}
          onViewChange={setView}
          selectedCaseId={selectedCaseId}
          onSelectCase={setSelectedCaseId}
          refreshToken={refreshToken}
          live={streamStatus === "connected"}
        />
        {selectedCaseId ? (
          <StaffCaseView
            key={selectedCaseId}
            identity={identity}
            caseId={selectedCaseId}
            onChanged={() => setRefreshToken((n) => n + 1)}
            signal={caseSignal}
            live={streamStatus === "connected"}
            onOpenCase={setSelectedCaseId}
            visible={page === "cases"}
          />
        ) : (
          <section className={styles.emptyConversation} aria-live="polite">
            <p>{t.staff.selectCase}</p>
          </section>
        )}
      </div>
    </div>
  );
}
