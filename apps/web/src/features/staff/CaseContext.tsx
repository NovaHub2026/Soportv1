"use client";

import {
  CASE_CATEGORIES,
  CASE_PRIORITIES,
  type CaseCategory,
  type CaseConsultation,
  type CaseEvent,
  type CasePriority,
  type ConsultationTeam,
  type ResolutionReason,
  type StaffCaseDetail,
  type UpdateCaseInput,
} from "@orbit-support/shared";
import { type ReactNode, useState } from "react";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import type { StaffIdentity } from "@/lib/staff-api";
import { OrbitCustomerSection } from "./OrbitCustomerSection";
import styles from "./staff.module.css";

interface CaseContextProps {
  detail: StaffCaseDetail;
  identity: StaffIdentity;
  onAnswer: (c: CaseConsultation, answer: string) => void;
  onAttributes: (input: UpdateCaseInput) => void;
  /** Role model (DEC-0029): false for a non-owner agent — category and priority are read-only (Cycle Audit 3). */
  mayEdit?: boolean;
  busy: boolean;
  children?: ReactNode;
}

/** The case's context column: consultations, incident, customer and Orbit summary, attributes and history (split from `StaffCaseView`, BL-014). */
export function CaseContext({ detail, identity, onAnswer, onAttributes, mayEdit = true, busy, children }: CaseContextProps) {
  const c = t.staff.context;
  const dash = c.none;
  const openConsultations = detail.consultations.filter((x) => x.status === "open").length;
  return (
    <aside className={styles.context} aria-label={c.title}>
      <h3 className={styles.contextTitle}>{t.staff.consultations.title}</h3>
      {openConsultations > 0 && (
        <p className={styles.consultationPending} role="status">
          {openConsultations === 1 ? t.staff.consultations.openOne : fill(t.staff.consultations.openMany, { n: String(openConsultations) })}
        </p>
      )}
      {detail.consultations.length === 0 ? (
        <p className={styles.consultationMeta}>{t.staff.consultations.none}</p>
      ) : (
        <ul className={styles.consultationList}>
          {detail.consultations.map((consultation) => (
            <ConsultationCard key={consultation.id} consultation={consultation} onAnswer={onAnswer} busy={busy} />
          ))}
        </ul>
      )}

      {children}
      <h3 className={`${styles.contextTitle} ${styles.contextTitleSpaced}`}>{c.customer}</h3>
      <dl className={styles.facts}>
        <dt>{c.customerId}</dt>
        <dd>{detail.customerId}</dd>
        <dt>{c.identitySource}</dt>
        <dd>{c.simulated}</dd>
      </dl>
      {/* Orbit context: available or explicitly unavailable, never an assumed value (RULE-SUP-07, PH-4.1). */}
      <OrbitCustomerSection key={detail.id} identity={identity} caseId={detail.id} />

      <h3 className={styles.contextTitle}>{c.caseSection}</h3>
      <dl className={styles.facts}>
        <dt>
          <label htmlFor="case-category">{c.category}</label>
        </dt>
        <dd>
          {detail.status === "closed" ? (
            t.category[detail.category]
          ) : (
            <select
              id="case-category"
              className={styles.inlineSelect}
              value={detail.category}
              disabled={busy || !mayEdit}
              title={mayEdit ? undefined : t.staff.actions.notOwner}
              onChange={(event) => onAttributes({ category: event.target.value as CaseCategory })}
            >
              {CASE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t.category[category]}
                </option>
              ))}
            </select>
          )}
        </dd>
        <dt>
          <label htmlFor="case-priority">{c.priority}</label>
        </dt>
        <dd>
          {detail.status === "closed" ? (
            t.staff.priority[detail.priority]
          ) : (
            <select
              id="case-priority"
              className={styles.inlineSelect}
              value={detail.priority}
              disabled={busy || !mayEdit}
              title={mayEdit ? undefined : t.staff.actions.notOwner}
              onChange={(event) => onAttributes({ priority: event.target.value as CasePriority })}
            >
              {CASE_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {t.staff.priority[priority]}
                </option>
              ))}
            </select>
          )}
        </dd>
        <dt>{c.createdAt}</dt>
        <dd>{formatMessageTime(detail.createdAt)}</dd>
        <dt>{c.lastCustomerMessage}</dt>
        <dd>{detail.lastCustomerMessageAt ? formatMessageTime(detail.lastCustomerMessageAt) : dash}</dd>
        <dt>{c.lastStaffMessage}</dt>
        <dd>{detail.lastStaffMessageAt ? formatMessageTime(detail.lastStaffMessageAt) : dash}</dd>
      </dl>

      <h3 className={styles.contextTitle}>{c.history}</h3>
      <ol className={styles.timeline}>
        {detail.events.map((event) => (
          <li key={event.id}>
            <time dateTime={event.createdAt}>{formatMessageTime(event.createdAt)}</time> {describeEvent(event)}
          </li>
        ))}
      </ol>
    </aside>
  );
}

function ConsultationCard({ consultation, onAnswer, busy }: { consultation: CaseConsultation; onAnswer: (c: CaseConsultation, answer: string) => void; busy: boolean }) {
  const [answer, setAnswer] = useState("");
  const c = t.staff.consultations;
  return (
    <li className={styles.consultation} data-status={consultation.status}>
      <div className={styles.consultationHead}>
        <strong>{t.staff.teams[consultation.team]}</strong>
        <span className={styles.consultationStatus}>{consultation.status === "open" ? c.pending : c.answered}</span>
      </div>
      <p className={styles.consultationText}>{consultation.question}</p>
      <p className={styles.consultationMeta}>
        {fill(c.requestedBy, { agent: consultation.requestedByName ?? consultation.requestedById, time: formatMessageTime(consultation.requestedAt) })}
      </p>
      {consultation.status === "answered" && consultation.answer && (
        <>
          <p className={styles.consultationAnswer}>{consultation.answer}</p>
          <p className={styles.consultationMeta}>
            {fill(c.answeredBy, {
              agent: consultation.answeredByName ?? consultation.answeredById ?? "",
              time: consultation.answeredAt ? formatMessageTime(consultation.answeredAt) : "",
            })}
          </p>
        </>
      )}
      {consultation.status === "open" && (
        <form
          className={styles.answerForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (answer.trim()) onAnswer(consultation, answer.trim());
          }}
        >
          <label className="visually-hidden" htmlFor={`answer-${consultation.id}`}>
            {c.answerLabel}
          </label>
          <textarea id={`answer-${consultation.id}`} className={styles.composerInput} rows={2} maxLength={5000} placeholder={c.answerLabel} value={answer} onChange={(event) => setAnswer(event.target.value)} />
          <button type="submit" className={styles.secondaryButton} disabled={!answer.trim() || busy}>
            {c.answerSubmit}
          </button>
        </form>
      )}
    </li>
  );
}

/** One line of the attributable history (RULE-SUP-09), worded through the dictionary. */
export function describeEvent(event: CaseEvent): string {
  const data = event.data as Record<string, unknown>;
  const str = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
  switch (event.type) {
    case "case_assigned":
      if (data.released === true) return fill(t.staff.assignment.releasedEvent, { by: str("releasedByName") || event.actorId });
      if (str("transferredByName")) {
        return fill(t.staff.assignment.transferredEvent, { agent: str("agentName") || str("agentId"), by: str("transferredByName") });
      }
      return fill(t.staff.events.case_assigned, { agent: str("agentName") || str("agentId") });
    case "case_resolved": {
      const reason = str("reason") as ResolutionReason;
      return fill(t.staff.events.case_resolved, { reason: t.staff.reasons[reason] ?? reason });
    }
    case "consultation_requested": {
      const team = str("team") as ConsultationTeam;
      return fill(t.staff.events.consultation_requested, { team: t.staff.teams[team] ?? team });
    }
    case "consultation_answered":
      return fill(t.staff.events.consultation_answered, { agent: str("answeredByName") || event.actorId });
    case "case_closed": {
      const reason = str("reason") as keyof typeof t.staff.closedReasons;
      return fill(t.staff.events.case_closed, { how: t.staff.closedReasons[reason] ?? reason });
    }
    case "follow_up_created":
      return fill(t.staff.events.follow_up_created, { reference: str("followUpReference") || str("parentReference") });
    case "incident_linked":
      return fill(t.staff.events.incident_linked, {
        change: data.unlinked === true ? t.staff.incidents.unlinkedEvent : fill(t.staff.incidents.linkedEvent, { incident: str("title") }),
      });
    case "priority_changed": {
      const from = str("from") as CasePriority;
      const to = str("to") as CasePriority;
      return fill(t.staff.events.priority_changed, { from: t.staff.priority[from] ?? from, to: t.staff.priority[to] ?? to });
    }
    case "category_changed": {
      const from = str("from") as CaseCategory;
      const to = str("to") as CaseCategory;
      return fill(t.staff.events.category_changed, { from: t.category[from] ?? from, to: t.category[to] ?? to });
    }
    case "status_changed": {
      const from = str("from") as keyof typeof t.staff.status;
      const to = str("to") as keyof typeof t.staff.status;
      return fill(t.staff.events.status_changed, { from: t.staff.status[from] ?? from, to: t.staff.status[to] ?? to });
    }
    default:
      return fill(t.staff.events[event.type], {});
  }
}
