"use client";

import type { StaffQueueView } from "@orbit-support/shared";
import { useMemo, useState } from "react";
import { dictionary as t } from "@/i18n";
import { SIMULATED_STAFF, useSimulatedStaff } from "@/lib/simulated-session";
import type { StaffIdentity } from "@/lib/staff-api";
import { StaffCaseView } from "./StaffCaseView";
import { StaffQueue } from "./StaffQueue";
import styles from "./staff.module.css";

/**
 * Three working areas (context §5.1): queues, conversation, customer/case context. Actions that change a
 * case bump `refreshToken` so the queue reflects them without waiting for its poll.
 */
export function StaffWorkspace() {
  const [staff, selectStaff] = useSimulatedStaff();
  const [view, setView] = useState<StaffQueueView>("unassigned");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const identity = useMemo<StaffIdentity>(
    () => ({ staffId: staff.id, displayName: staff.name, role: staff.role }),
    [staff.id, staff.name, staff.role],
  );

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
        />
        {selectedCaseId ? (
          <StaffCaseView
            key={selectedCaseId}
            identity={identity}
            caseId={selectedCaseId}
            onChanged={() => setRefreshToken((n) => n + 1)}
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
