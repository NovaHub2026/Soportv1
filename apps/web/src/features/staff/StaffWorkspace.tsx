"use client";

import { isStreamEvent, type StaffQueueView } from "@orbit-support/shared";
import { useEffect, useMemo, useState } from "react";
import { dictionary as t } from "@/i18n";
import { SIMULATED_STAFF, useSimulatedStaff } from "@/lib/simulated-session";
import { type StreamStatus, subscribeStream } from "@/lib/sse";
import { type StaffIdentity, staffIdentityHeaders } from "@/lib/staff-api";
import { StaffCaseView } from "./StaffCaseView";
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
  const [staff, selectStaff] = useSimulatedStaff();
  const [view, setView] = useState<StaffQueueView>("unassigned");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [caseSignal, setCaseSignal] = useState<CaseSignal | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
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
                {s.name} · {s.role}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className={styles.columns}>
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
