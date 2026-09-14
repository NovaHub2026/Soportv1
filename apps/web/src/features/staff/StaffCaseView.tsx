"use client";

import {
  CASE_CATEGORIES,
  CASE_PRIORITIES,
  type CaseCategory,
  type CaseConsultation,
  type CaseEvent,
  type CaseMessage,
  type CasePriority,
  CONSULTATION_TEAMS,
  type ConsultationTeam,
  RESOLUTION_REASONS,
  type ResolutionReason,
  type StaffCaseDetail,
  type StaffStatusTarget,
  type UpdateCaseInput,
} from "@orbit-support/shared";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttachmentComposer } from "@/features/support/AttachmentComposer";
import { AttachmentList } from "@/features/support/AttachmentList";
import { StatusBadge } from "@/features/support/StatusBadge";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { ApiError, apiErrorCode, type AttachmentClient, newClientMessageId } from "@/lib/api";
import { SIMULATED_STAFF } from "@/lib/simulated-session";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import { IncidentSection } from "./IncidentSection";
import styles from "./staff.module.css";

/** Safety-net refresh while the staff stream is down (ADR-0004). */
export const CASE_REFRESH_INTERVAL_MS = 5000;
/** Safety-net refresh while the staff stream is connected. */
export const CASE_CONNECTED_REFRESH_INTERVAL_MS = 60_000;

interface StaffCaseViewProps {
  identity: StaffIdentity;
  caseId: string;
  onChanged: () => void;
  /** Latest change announced by the staff stream; a signal for this case triggers a re-read. */
  signal?: { caseId: string; seq: number } | null;
  live?: boolean;
  /** Open another case in the workspace (the previous case of a follow-up). */
  onOpenCase?: (caseId: string) => void;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; detail: StaffCaseDetail };
type ActionState = { status: "idle" } | { status: "busy" } | { status: "error"; message: string };

/** Conversation (public replies and internal notes, visibly distinct — RULE-SUP-04) plus case context. */
export function StaffCaseView({ identity, caseId, onChanged, signal = null, live = false, onOpenCase }: StaffCaseViewProps) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [take, setTake] = useState<ActionState>({ status: "idle" });
  const [reply, setReply] = useState<ActionState>({ status: "idle" });
  const [draft, setDraft] = useState("");
  const [clientMessageId, setClientMessageId] = useState(() => newClientMessageId());
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [attachClearToken, setAttachClearToken] = useState(0);
  const [action, setAction] = useState<ActionState>({ status: "idle" });
  const [resolving, setResolving] = useState(false);
  const [resolveReason, setResolveReason] = useState<ResolutionReason>("solved");
  const [resolveExplanation, setResolveExplanation] = useState("");
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply");
  const [consulting, setConsulting] = useState(false);
  const [consultTeam, setConsultTeam] = useState<ConsultationTeam>("finance");
  const [consultQuestion, setConsultQuestion] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string>("");
  const logRef = useRef<HTMLOListElement>(null);
  const attachmentClient = useMemo(() => staffApi.attachments(identity, caseId), [identity, caseId]);
  // Monotonic request counter: a poll that started before an action must not overwrite the action's result.
  const requestSeq = useRef(0);

  /** Staff have the case open: customer messages received so far are read (unread counts drop in the queue). */
  const markRead = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    staffApi.markRead(identity, caseId).then(
      () => setLoad((current) => (current.status === "ready" ? { status: "ready", detail: { ...current.detail, unreadCount: 0 } } : current)),
      (error: unknown) => console.warn("staff: could not mark read", error),
    );
  }, [identity, caseId]);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const id = ++requestSeq.current;
      try {
        const detail = await staffApi.getCase(identity, caseId, signal);
        if (id !== requestSeq.current) return; // superseded by a newer request
        setLoad({ status: "ready", detail });
        if (detail.unreadCount > 0) markRead();
      } catch (error: unknown) {
        if (signal?.aborted || id !== requestSeq.current) return;
        console.warn("staff: could not load case", error);
        setLoad((current) => (current.status === "ready" ? current : { status: "error" }));
      }
    },
    [identity, caseId, markRead],
  );

  useEffect(() => {
    const controller = new AbortController();
    // The effect only subscribes: the first read and every tick run as callbacks, never synchronously here.
    queueMicrotask(() => void refresh(controller.signal));
    const timer = setInterval(() => void refresh(controller.signal), live ? CASE_CONNECTED_REFRESH_INTERVAL_MS : CASE_REFRESH_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh, live]);

  // Live updates: the workspace's stream announced a change on this case.
  useEffect(() => {
    if (signal?.caseId === caseId) queueMicrotask(() => void refresh());
  }, [signal, caseId, refresh]);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView?.({ block: "end" });
  }, [load]);

  async function handleTake() {
    setTake({ status: "busy" });
    try {
      await staffApi.takeCase(identity, caseId);
      await refresh();
      setTake({ status: "idle" });
      onChanged();
    } catch (error) {
      console.warn("staff: could not take case", error);
      setTake({ status: "error", message: t.staff.takeFailed });
    }
  }

  async function handleStatus(target: StaffStatusTarget) {
    setAction({ status: "busy" });
    try {
      await staffApi.setStatus(identity, caseId, target);
      await refresh();
      setAction({ status: "idle" });
      onChanged();
    } catch (error) {
      console.warn("staff: could not change status", error);
      setAction({ status: "error", message: t.staff.actions.failed });
    }
  }

  async function handleResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const explanation = resolveExplanation.trim();
    if (!explanation) return;
    setAction({ status: "busy" });
    try {
      await staffApi.resolve(identity, caseId, { reason: resolveReason, explanation });
      setResolving(false);
      setResolveExplanation("");
      await refresh();
      setAction({ status: "idle" });
      onChanged();
    } catch (error) {
      console.warn("staff: could not resolve case", error);
      setAction({ status: "error", message: apiErrorCode(error) === "consultations_open" ? t.staff.actions.consultationsOpen : t.staff.actions.failed });
    }
  }

  async function handleClose() {
    setAction({ status: "busy" });
    try {
      await staffApi.close(identity, caseId);
      await refresh();
      setAction({ status: "idle" });
      onChanged();
    } catch (error) {
      console.warn("staff: could not close case", error);
      setAction({ status: "error", message: t.staff.actions.failed });
    }
  }

  async function handleAssign(agentId: string | null) {
    setAction({ status: "busy" });
    try {
      await staffApi.assign(identity, caseId, { agentId });
      setTransferring(false);
      await refresh();
      setAction({ status: "idle" });
      onChanged();
    } catch (error) {
      console.warn("staff: could not assign case", error);
      setAction({ status: "error", message: error instanceof ApiError && error.status === 403 ? t.staff.assignment.forbidden : t.staff.assignment.failed });
    }
  }

  async function handleAttributes(input: UpdateCaseInput) {
    setAction({ status: "busy" });
    try {
      await staffApi.update(identity, caseId, input);
      await refresh();
      setAction({ status: "idle" });
      onChanged();
    } catch (error) {
      console.warn("staff: could not update case", error);
      setAction({ status: "error", message: t.staff.attributes.failed });
    }
  }

  async function handleConsult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = consultQuestion.trim();
    if (!question) return;
    setAction({ status: "busy" });
    try {
      await staffApi.requestConsultation(identity, caseId, { team: consultTeam, question });
      setConsulting(false);
      setConsultQuestion("");
      await refresh();
      setAction({ status: "idle" });
      onChanged();
    } catch (error) {
      console.warn("staff: could not request consultation", error);
      setAction({ status: "error", message: t.staff.consultations.failed });
    }
  }

  async function handleAnswer(consultation: CaseConsultation, answer: string) {
    setAction({ status: "busy" });
    try {
      await staffApi.answerConsultation(identity, caseId, consultation.id, { answer });
      await refresh();
      setAction({ status: "idle" });
      onChanged();
    } catch (error) {
      console.warn("staff: could not answer consultation", error);
      setAction({ status: "error", message: t.staff.consultations.failed });
    }
  }

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setReply({ status: "busy" });
    try {
      if (composerMode === "note") {
        await staffApi.postNote(identity, caseId, { body });
      } else {
        await staffApi.postMessage(identity, caseId, {
          body,
          clientMessageId,
          ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
        });
        setAttachmentIds([]);
        setAttachClearToken((n) => n + 1);
        setClientMessageId(newClientMessageId());
      }
      setDraft("");
      await refresh();
      setReply({ status: "idle" });
      onChanged();
    } catch (error) {
      console.warn("staff: could not send", error);
      setReply({ status: "error", message: composerMode === "note" ? t.staff.notes.failed : t.staff.sendFailed });
    }
  }

  if (load.status === "loading") {
    return (
      <section className={styles.conversation}>
        <p className={styles.muted} role="status">
          {t.staff.loading}
        </p>
      </section>
    );
  }
  if (load.status === "error") {
    return (
      <section className={styles.conversation}>
        <p className={styles.errorText} role="alert">
          {t.staff.error}
        </p>
      </section>
    );
  }

  const { detail } = load;
  const mine = detail.assignedAgentId === identity.staffId;
  const canTake = detail.assignedAgentId === null && detail.status !== "resolved" && detail.status !== "closed";
  const canReply = detail.status !== "closed";
  // Whether the customer has seen the latest staff reply (§4.3): read marker at or after the last staff message.
  const customerReadLatest =
    detail.lastStaffMessageAt !== null &&
    detail.customerLastReadAt !== null &&
    new Date(detail.customerLastReadAt).getTime() >= new Date(detail.lastStaffMessageAt).getTime();

  return (
    <>
      <section className={styles.conversation} aria-label={detail.reference}>
        <header className={styles.caseHeader}>
          <div className={styles.caseHeaderTop}>
            <h2 className={styles.caseTitle}>
              {detail.reference} · {detail.subject}
            </h2>
            <StatusBadge status={detail.status} labels={t.staff.status} />
          </div>
          <div className={styles.caseHeaderMeta}>
            <span>
              {t.staff.responsible}: <strong>{detail.assignedAgentId ?? t.staff.unassigned}</strong>
              {mine ? ` (${t.staff.you})` : ""}
            </span>
            {canTake && (
              <button type="button" className={styles.primaryButton} onClick={handleTake} disabled={take.status === "busy"}>
                {take.status === "busy" ? t.staff.taking : t.staff.take}
              </button>
            )}
          </div>
          {take.status === "error" && (
            <p className={styles.errorText} role="alert">
              {take.message}
            </p>
          )}
          {detail.lastStaffMessageAt && (
            <p className={styles.readState} data-read={customerReadLatest ? "true" : "false"}>
              {customerReadLatest ? t.staff.customerRead : t.staff.customerUnread}
              {customerReadLatest && detail.customerLastReadAt ? ` · ${formatMessageTime(detail.customerLastReadAt)}` : ""}
            </p>
          )}
          {detail.status === "resolved" && detail.resolutionReason && (
            <p className={styles.readState}>{fill(t.staff.actions.resolvedAs, { reason: t.staff.reasons[detail.resolutionReason] })}</p>
          )}
          {detail.parentReference && (
            <p className={styles.readState}>
              {fill(t.staff.actions.followUpOf, { reference: detail.parentReference })}
              {detail.parentCaseId && onOpenCase && (
                <>
                  {" · "}
                  <button type="button" className={styles.linkButton} onClick={() => onOpenCase(detail.parentCaseId!)}>
                    {t.staff.actions.openPrevious}
                  </button>
                </>
              )}
            </p>
          )}

          {detail.status !== "closed" && (
            <div className={styles.actions} role="group" aria-label={t.staff.actions.title}>
              {detail.status !== "waiting_customer" && (
                <button type="button" className={styles.secondaryButton} disabled={action.status === "busy"} onClick={() => void handleStatus("waiting_customer")}>
                  {t.staff.actions.waitCustomer}
                </button>
              )}
              {detail.status !== "waiting_internal" && (
                <button type="button" className={styles.secondaryButton} disabled={action.status === "busy"} onClick={() => void handleStatus("waiting_internal")}>
                  {t.staff.actions.waitInternal}
                </button>
              )}
              {detail.status !== "in_progress" && detail.status !== "new" && (
                <button type="button" className={styles.secondaryButton} disabled={action.status === "busy"} onClick={() => void handleStatus("in_progress")}>
                  {t.staff.actions.resume}
                </button>
              )}
              {!consulting && (
                <button type="button" className={styles.secondaryButton} disabled={action.status === "busy"} onClick={() => setConsulting(true)}>
                  {t.staff.consultations.request}
                </button>
              )}
              {!transferring && (
                <button type="button" className={styles.secondaryButton} disabled={action.status === "busy"} onClick={() => setTransferring(true)}>
                  {t.staff.assignment.transfer}
                </button>
              )}
              {detail.assignedAgentId && (
                <button type="button" className={styles.secondaryButton} disabled={action.status === "busy"} onClick={() => void handleAssign(null)}>
                  {t.staff.assignment.release}
                </button>
              )}
              {detail.status !== "resolved" && !resolving && (
                <button type="button" className={styles.resolveButton} disabled={action.status === "busy"} onClick={() => setResolving(true)}>
                  {t.staff.actions.resolve}
                </button>
              )}
              {detail.status === "resolved" && (
                <button type="button" className={styles.secondaryButton} disabled={action.status === "busy"} onClick={() => void handleClose()}>
                  {t.staff.actions.close}
                </button>
              )}
            </div>
          )}
          {transferring && (
            <form
              className={styles.transferForm}
              aria-label={t.staff.assignment.transfer}
              onSubmit={(event) => {
                event.preventDefault();
                if (transferTarget) void handleAssign(transferTarget);
              }}
            >
              <label className={styles.composerLabel} htmlFor="transfer-target">
                {t.staff.assignment.transferTo}
              </label>
              <select id="transfer-target" className={styles.select} value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)}>
                <option value="">—</option>
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
                <button type="submit" className={styles.primaryButton} disabled={!transferTarget || action.status === "busy"}>
                  {t.staff.assignment.confirm}
                </button>
              </div>
            </form>
          )}
          {consulting && (
            <form className={styles.consultForm} onSubmit={handleConsult} aria-label={t.staff.consultations.request}>
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
              <textarea
                id="consult-question"
                className={styles.composerInput}
                rows={3}
                maxLength={5000}
                value={consultQuestion}
                onChange={(event) => setConsultQuestion(event.target.value)}
              />
              <div className={styles.composerActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setConsulting(false)}>
                  {t.staff.consultations.cancel}
                </button>
                <button type="submit" className={styles.primaryButton} disabled={!consultQuestion.trim() || action.status === "busy"}>
                  {t.staff.consultations.submit}
                </button>
              </div>
            </form>
          )}
          {action.status === "error" && (
            <p className={styles.errorText} role="alert">
              {action.message}
            </p>
          )}
          {resolving && (
            <form className={styles.resolveForm} onSubmit={handleResolve} aria-label={t.staff.actions.resolve}>
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
                <button type="submit" className={styles.primaryButton} disabled={!resolveExplanation.trim() || action.status === "busy"}>
                  {t.staff.actions.resolveConfirm}
                </button>
              </div>
            </form>
          )}
        </header>

        <ol ref={logRef} className={styles.messageLog} aria-live="polite" aria-relevant="additions">
          {detail.messages.map((m) => (
            <StaffMessage key={m.id} message={m} selfId={identity.staffId} attachmentClient={attachmentClient} />
          ))}
        </ol>

        {canReply && (
          <form className={styles.composer} onSubmit={handleReply} data-mode={composerMode}>
            {/* "Reply to customer" and "Internal note" are visibly different actions (context §5.3, RULE-SUP-04). */}
            <fieldset className={styles.modeSwitch}>
              <legend className="visually-hidden">{t.staff.notes.modeLabel}</legend>
              <label className={styles.modeOption} data-selected={composerMode === "reply" ? "true" : "false"}>
                <input type="radio" name="composer-mode" value="reply" checked={composerMode === "reply"} onChange={() => setComposerMode("reply")} className="visually-hidden" />
                {t.staff.notes.replyMode}
              </label>
              <label className={styles.modeOption} data-selected={composerMode === "note" ? "true" : "false"} data-note="true">
                <input type="radio" name="composer-mode" value="note" checked={composerMode === "note"} onChange={() => setComposerMode("note")} className="visually-hidden" />
                {t.staff.notes.noteMode}
              </label>
            </fieldset>
            <label htmlFor="staff-reply" className={styles.composerLabel}>
              {composerMode === "note" ? t.staff.notes.noteLabel : t.staff.replyLabel}
            </label>
            <textarea
              id="staff-reply"
              className={styles.composerInput}
              rows={3}
              maxLength={5000}
              placeholder={composerMode === "note" ? t.staff.notes.notePlaceholder : t.staff.replyPlaceholder}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {reply.status === "error" && (
              <p className={styles.errorText} role="alert">
                {reply.message}
              </p>
            )}
            {composerMode === "reply" && (
              <AttachmentComposer client={attachmentClient} onReadyChange={setAttachmentIds} clearToken={attachClearToken} idPrefix="staff-attach" />
            )}
            <div className={styles.composerActions}>
              <button type="submit" className={composerMode === "note" ? styles.noteButton : styles.primaryButton} disabled={!draft.trim() || reply.status === "busy"}>
                {reply.status === "busy" ? (composerMode === "note" ? t.staff.notes.saving : t.staff.sending) : composerMode === "note" ? t.staff.notes.save : t.staff.reply}
              </button>
            </div>
          </form>
        )}
      </section>

      <CaseContext detail={detail} onAnswer={handleAnswer} onAttributes={handleAttributes} busy={action.status === "busy"}>
        <IncidentSection
          identity={identity}
          detail={detail}
          onChanged={() => {
            void refresh();
            onChanged();
          }}
        />
      </CaseContext>
    </>
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

function StaffMessage({ message, selfId, attachmentClient }: { message: CaseMessage; selfId: string; attachmentClient: AttachmentClient }) {
  const internal = message.visibility === "internal";
  const author =
    message.authorType === "customer"
      ? t.staff.customer
      : message.authorType === "system"
        ? t.staff.system
        : `${message.authorName ?? message.authorId}${message.authorId === selfId ? ` (${t.staff.you})` : ""}`;
  return (
    <li className={styles.message} data-author={message.authorType} data-visibility={message.visibility}>
      <div className={styles.messageHead}>
        <span className={styles.messageAuthor}>{author}</span>
        {internal && (
          <span className={styles.internalTag}>
            {t.staff.internalNote} · {t.staff.internalNoteHint}
          </span>
        )}
        <time className={styles.messageTime} dateTime={message.createdAt}>
          {formatMessageTime(message.createdAt)}
        </time>
      </div>
      <p className={styles.messageBody}>{message.body}</p>
      <AttachmentList attachments={message.attachments} client={attachmentClient} />
    </li>
  );
}

function describeEvent(event: CaseEvent): string {
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

function CaseContext({
  detail,
  onAnswer,
  onAttributes,
  busy,
  children,
}: {
  detail: StaffCaseDetail;
  onAnswer: (c: CaseConsultation, answer: string) => void;
  onAttributes: (input: UpdateCaseInput) => void;
  busy: boolean;
  children?: React.ReactNode;
}) {
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
      {/* Missing data is shown as unavailable, never as an assumed value (RULE-SUP-07). */}
      <p className={styles.unavailable} role="note">
        {c.orbitUnavailable}
      </p>

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
              disabled={busy}
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
              disabled={busy}
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
