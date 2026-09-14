"use client";

import { caseOwnership, staffMay, type StaffCaseDetail } from "@orbit-support/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RecordCard } from "@/features/support/RecordCard";
import { StatusBadge } from "@/features/support/StatusBadge";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { ApiError, apiErrorCode } from "@/lib/api";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import { CaseActions } from "./CaseActions";
import { CaseContext } from "./CaseContext";
import { IncidentSection } from "./IncidentSection";
import { StaffComposer } from "./StaffComposer";
import { StaffMessage } from "./StaffMessage";
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
  /** False while another workspace page (saved replies, supervision) hides the case: nothing is marked read then (FND-0054). */
  visible?: boolean;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; detail: StaffCaseDetail };
type ActionState = { status: "idle" } | { status: "busy" } | { status: "error"; message: string };

/**
 * Conversation (public replies and internal notes, visibly distinct — RULE-SUP-04) plus case context. The state
 * actions, the composer, the messages and the context column live in their own components (BL-014); every action
 * goes through `runAction`.
 */
export function StaffCaseView({ identity, caseId, onChanged, signal = null, live = false, onOpenCase, visible = true }: StaffCaseViewProps) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [take, setTake] = useState<ActionState>({ status: "idle" });
  const [action, setAction] = useState<ActionState>({ status: "idle" });
  const logRef = useRef<HTMLOListElement>(null);
  const attachmentClient = useMemo(() => staffApi.attachments(identity, caseId), [identity, caseId]);
  // Monotonic request counter: a poll that started before an action must not overwrite the action's result.
  const requestSeq = useRef(0);

  /** Staff have the case open: customer messages received so far are read (unread counts drop in the queue). */
  const markRead = useCallback(() => {
    if (!visible) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    staffApi.markRead(identity, caseId).then(
      () => setLoad((current) => (current.status === "ready" ? { status: "ready", detail: { ...current.detail, unreadCount: 0 } } : current)),
      (error: unknown) => console.warn("staff: could not mark read", error),
    );
  }, [identity, caseId, visible]);

  // Coming back to the case page marks what arrived meanwhile as read (the load path only runs on a refresh).
  useEffect(() => {
    if (visible && load.status === "ready" && load.detail.unreadCount > 0) markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the visibility change matters here
  }, [visible]);

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

  /**
   * One path for every case action (BL-014, FND-0024): busy → call → re-read → tell the workspace. A failure says
   * why and leaves the form as it was; `true` lets a form close only after the change was saved.
   */
  async function runAction(work: () => Promise<unknown>, failure: (error: unknown) => string, setState: (state: ActionState) => void = setAction): Promise<boolean> {
    setState({ status: "busy" });
    try {
      await work();
      await refresh();
      setState({ status: "idle" });
      onChanged();
      return true;
    } catch (error) {
      console.warn("staff: case action failed", error);
      setState({ status: "error", message: failure(error) });
      return false;
    }
  }
  const refusedOr = (fallback: string) => (error: unknown) => forbiddenOr(error, fallback);

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
  // The role model (PH-7.2, DEC-0029) mirrored from the shared table: refused actions are disabled with the reason.
  const ownership = caseOwnership(detail.assignedAgentId, identity.staffId);
  const notOwner = !staffMay(identity.role, "set_status", ownership);
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
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void runAction(() => staffApi.takeCase(identity, caseId), () => t.staff.takeFailed, setTake)}
                disabled={take.status === "busy"}
              >
                {take.status === "busy" ? t.staff.taking : t.staff.take}
              </button>
            )}
          </div>
          {take.status === "error" && (
            <p className={styles.errorText} role="alert">
              {take.message}
            </p>
          )}
          {detail.record && (
            <RecordCard kind={detail.record.kind} reference={detail.record.reference} snapshot={detail.record.snapshot} lookupReason={detail.record.lookupReason} capturedAt={detail.record.capturedAt} detailed testId="staff-case-record" />
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

          {detail.status !== "closed" && notOwner && (
            <p className={styles.hint} role="note" data-testid="not-owner-hint">
              {t.staff.actions.notOwner}
            </p>
          )}
          <CaseActions
            detail={detail}
            identity={identity}
            busy={action.status === "busy"}
            notOwner={notOwner}
            error={action.status === "error" ? action.message : null}
            onStatus={(target) => void runAction(() => staffApi.setStatus(identity, caseId, target), refusedOr(t.staff.actions.failed))}
            onClose={() => void runAction(() => staffApi.close(identity, caseId), refusedOr(t.staff.actions.failed))}
            onAssign={(agentId) =>
              runAction(
                () => staffApi.assign(identity, caseId, { agentId }),
                (error) => (error instanceof ApiError && error.status === 403 ? t.staff.assignment.forbidden : t.staff.assignment.failed),
              )
            }
            onConsult={(team, question) => runAction(() => staffApi.requestConsultation(identity, caseId, { team, question }), () => t.staff.consultations.failed)}
            onResolve={(reason, explanation) =>
              runAction(
                () => staffApi.resolve(identity, caseId, { reason, explanation }),
                (error) => (apiErrorCode(error) === "consultations_open" ? t.staff.actions.consultationsOpen : forbiddenOr(error, t.staff.actions.failed)),
              )
            }
          />
        </header>

        <ol ref={logRef} className={styles.messageLog} aria-live="polite" aria-relevant="additions">
          {detail.messages.map((m) => (
            <StaffMessage key={m.id} message={m} selfId={identity.staffId} attachmentClient={attachmentClient} />
          ))}
        </ol>

        {canReply && (
          <StaffComposer
            identity={identity}
            caseId={caseId}
            attachmentClient={attachmentClient}
            onSent={async () => {
              await refresh();
              onChanged();
            }}
          />
        )}
      </section>

      <CaseContext
        detail={detail}
        identity={identity}
        onAnswer={(consultation, answer) => void runAction(() => staffApi.answerConsultation(identity, caseId, consultation.id, { answer }), () => t.staff.consultations.failed)}
        onAttributes={(input) => void runAction(() => staffApi.update(identity, caseId, input), refusedOr(t.staff.attributes.failed))}
        busy={action.status === "busy"}
        mayEdit={staffMay(identity.role, "edit_attributes", ownership)}
      >
        <IncidentSection
          identity={identity}
          detail={detail}
          mayLink={staffMay(identity.role, "link_incident", ownership)}
          onChanged={() => {
            void refresh();
            onChanged();
          }}
        />
      </CaseContext>
    </>
  );
}

/** A 403 on a case action means the role model refused it (PH-7.2): say so instead of "try again". */
function forbiddenOr(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.status === 403 ? t.staff.actions.notOwner : fallback;
}
