"use client";

import { CONSULTATION_TEAMS, type ConsultationTeam, RESOLUTION_REASONS, type ResolutionReason, type StaffCaseDetail, type StaffStatusTarget } from "@orbit-support/shared";
import { type FormEvent, useState } from "react";
import { dictionary as t } from "@/i18n";
import { SIMULATED_STAFF } from "@/lib/simulated-session";
import type { StaffIdentity } from "@/lib/staff-api";
import styles from "./staff.module.css";

interface CaseActionsProps {
  detail: StaffCaseDetail;
  identity: StaffIdentity;
  busy: boolean;
  /** Role model (DEC-0029): a non-owner agent sees the state actions disabled with the reason. */
  notOwner: boolean;
  error: string | null;
  onStatus: (target: StaffStatusTarget) => void;
  onClose: () => void;
  /** Each resolves true once the change is saved: a form closes only then, and keeps what was typed otherwise (BL-014). */
  onAssign: (agentId: string | null) => Promise<boolean>;
  onConsult: (team: ConsultationTeam, question: string) => Promise<boolean>;
  onResolve: (reason: ResolutionReason, explanation: string) => Promise<boolean>;
}

/** The case's state actions and their forms — transfer, consultation, resolution — split from `StaffCaseView` (BL-014). */
export function CaseActions({ detail, identity, busy, notOwner, error, onStatus, onClose, onAssign, onConsult, onResolve }: CaseActionsProps) {
  const [resolving, setResolving] = useState(false);
  const [resolveReason, setResolveReason] = useState<ResolutionReason>("solved");
  const [resolveExplanation, setResolveExplanation] = useState("");
  const [consulting, setConsulting] = useState(false);
  const [consultTeam, setConsultTeam] = useState<ConsultationTeam>("finance");
  const [consultQuestion, setConsultQuestion] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const stateReason = notOwner ? t.staff.actions.notOwner : undefined;
  const assignReason = notOwner ? t.staff.assignment.forbidden : undefined;

  async function submitResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const explanation = resolveExplanation.trim();
    if (!explanation) return;
    if (await onResolve(resolveReason, explanation)) {
      setResolving(false);
      setResolveExplanation("");
    }
  }

  async function submitConsult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = consultQuestion.trim();
    if (!question) return;
    if (await onConsult(consultTeam, question)) {
      setConsulting(false);
      setConsultQuestion("");
    }
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (transferTarget && (await onAssign(transferTarget))) setTransferring(false);
  }

  return (
    <>
      {detail.status !== "closed" && (
        <div className={styles.actions} role="group" aria-label={t.staff.actions.title}>
          {detail.status !== "waiting_customer" && (
            <button type="button" className={styles.secondaryButton} disabled={busy || notOwner} title={stateReason} onClick={() => onStatus("waiting_customer")}>
              {t.staff.actions.waitCustomer}
            </button>
          )}
          {detail.status !== "waiting_internal" && (
            <button type="button" className={styles.secondaryButton} disabled={busy || notOwner} title={stateReason} onClick={() => onStatus("waiting_internal")}>
              {t.staff.actions.waitInternal}
            </button>
          )}
          {detail.status !== "in_progress" && detail.status !== "new" && (
            <button type="button" className={styles.secondaryButton} disabled={busy || notOwner} title={stateReason} onClick={() => onStatus("in_progress")}>
              {t.staff.actions.resume}
            </button>
          )}
          {!consulting && (
            <button type="button" className={styles.secondaryButton} disabled={busy || notOwner} title={stateReason} onClick={() => setConsulting(true)}>
              {t.staff.consultations.request}
            </button>
          )}
          {!transferring && (
            <button type="button" className={styles.secondaryButton} disabled={busy || notOwner} title={assignReason} onClick={() => setTransferring(true)}>
              {t.staff.assignment.transfer}
            </button>
          )}
          {detail.assignedAgentId && (
            <button type="button" className={styles.secondaryButton} disabled={busy || notOwner} title={assignReason} onClick={() => void onAssign(null)}>
              {t.staff.assignment.release}
            </button>
          )}
          {detail.status !== "resolved" && !resolving && (
            <button type="button" className={styles.resolveButton} disabled={busy || notOwner} title={stateReason} onClick={() => setResolving(true)}>
              {t.staff.actions.resolve}
            </button>
          )}
          {detail.status === "resolved" && (
            <button type="button" className={styles.secondaryButton} disabled={busy || notOwner} title={stateReason} onClick={onClose}>
              {t.staff.actions.close}
            </button>
          )}
        </div>
      )}
      {transferring && (
        <form className={styles.transferForm} aria-label={t.staff.assignment.transfer} onSubmit={(event) => void submitTransfer(event)}>
          <label className={styles.composerLabel} htmlFor="transfer-target">
            {t.staff.assignment.transferTo}
          </label>
          <select id="transfer-target" className={styles.select} value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)}>
            <option value="">{t.staff.supervision.reassignPlaceholder}</option>
            {SIMULATED_STAFF.filter((s) => s.id !== identity.staffId).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {t.staff.roles[s.role]}
              </option>
            ))}
          </select>
          <div className={styles.composerActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setTransferring(false)}>
              {t.staff.assignment.cancel}
            </button>
            <button type="submit" className={styles.primaryButton} disabled={!transferTarget || busy}>
              {t.staff.assignment.confirm}
            </button>
          </div>
        </form>
      )}
      {consulting && (
        <form className={styles.consultForm} onSubmit={(event) => void submitConsult(event)} aria-label={t.staff.consultations.request}>
          <label className={styles.composerLabel} htmlFor="consult-team">
            {t.staff.consultations.team}
          </label>
          <select id="consult-team" className={styles.select} value={consultTeam} onChange={(event) => setConsultTeam(event.target.value as ConsultationTeam)}>
            {CONSULTATION_TEAMS.map((team) => (
              <option key={team} value={team}>
                {t.staff.teams[team]}
              </option>
            ))}
          </select>
          <label className={styles.composerLabel} htmlFor="consult-question">
            {t.staff.consultations.question}
          </label>
          <textarea id="consult-question" className={styles.composerInput} rows={3} maxLength={5000} value={consultQuestion} onChange={(event) => setConsultQuestion(event.target.value)} />
          <div className={styles.composerActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setConsulting(false)}>
              {t.staff.consultations.cancel}
            </button>
            <button type="submit" className={styles.primaryButton} disabled={!consultQuestion.trim() || busy}>
              {t.staff.consultations.submit}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
      {resolving && (
        <form className={styles.resolveForm} onSubmit={(event) => void submitResolve(event)} aria-label={t.staff.actions.resolve}>
          <label className={styles.composerLabel} htmlFor="resolve-reason">
            {t.staff.actions.resolveReason}
          </label>
          <select id="resolve-reason" className={styles.select} value={resolveReason} onChange={(event) => setResolveReason(event.target.value as ResolutionReason)}>
            {RESOLUTION_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {t.staff.reasons[reason]}
              </option>
            ))}
          </select>
          <label className={styles.composerLabel} htmlFor="resolve-explanation">
            {t.staff.actions.resolveExplanation}
          </label>
          <textarea
            id="resolve-explanation"
            className={styles.composerInput}
            rows={3}
            maxLength={5000}
            value={resolveExplanation}
            onChange={(event) => setResolveExplanation(event.target.value)}
            aria-describedby="resolve-explanation-hint"
          />
          <p id="resolve-explanation-hint" className={styles.hint}>
            {t.staff.actions.resolveExplanationHint}
          </p>
          <div className={styles.composerActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setResolving(false)}>
              {t.staff.actions.cancel}
            </button>
            <button type="submit" className={styles.primaryButton} disabled={!resolveExplanation.trim() || busy}>
              {t.staff.actions.resolveConfirm}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
