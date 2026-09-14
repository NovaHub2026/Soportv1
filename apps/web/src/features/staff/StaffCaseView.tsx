"use client";

import type { CaseEvent, CaseMessage, StaffCaseDetail } from "@orbit-support/shared";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/features/support/StatusBadge";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { newClientMessageId } from "@/lib/api";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import styles from "./staff.module.css";

export const CASE_REFRESH_INTERVAL_MS = 5000;

interface StaffCaseViewProps {
  identity: StaffIdentity;
  caseId: string;
  onChanged: () => void;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; detail: StaffCaseDetail };
type ActionState = { status: "idle" } | { status: "busy" } | { status: "error"; message: string };

/** Conversation (public replies and internal notes, visibly distinct — RULE-SUP-04) plus case context. */
export function StaffCaseView({ identity, caseId, onChanged }: StaffCaseViewProps) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [take, setTake] = useState<ActionState>({ status: "idle" });
  const [reply, setReply] = useState<ActionState>({ status: "idle" });
  const [draft, setDraft] = useState("");
  const [clientMessageId, setClientMessageId] = useState(() => newClientMessageId());
  const logRef = useRef<HTMLOListElement>(null);
  // Monotonic request counter: a poll that started before an action must not overwrite the action's result.
  const requestSeq = useRef(0);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const id = ++requestSeq.current;
      try {
        const detail = await staffApi.getCase(identity, caseId, signal);
        if (id !== requestSeq.current) return; // superseded by a newer request
        setLoad({ status: "ready", detail });
      } catch (error: unknown) {
        if (signal?.aborted || id !== requestSeq.current) return;
        console.warn("staff: could not load case", error);
        setLoad((current) => (current.status === "ready" ? current : { status: "error" }));
      }
    },
    [identity, caseId],
  );

  useEffect(() => {
    const controller = new AbortController();
    // The effect only subscribes: the first read and every tick run as callbacks, never synchronously here.
    queueMicrotask(() => void refresh(controller.signal));
    const timer = setInterval(() => void refresh(controller.signal), CASE_REFRESH_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh]);

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

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setReply({ status: "busy" });
    try {
      await staffApi.postMessage(identity, caseId, { body, clientMessageId });
      setDraft("");
      setClientMessageId(newClientMessageId());
      await refresh();
      setReply({ status: "idle" });
      onChanged();
    } catch (error) {
      console.warn("staff: could not send reply", error);
      setReply({ status: "error", message: t.staff.sendFailed });
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
        </header>

        <ol ref={logRef} className={styles.messageLog} aria-live="polite" aria-relevant="additions">
          {detail.messages.map((m) => (
            <StaffMessage key={m.id} message={m} selfId={identity.staffId} />
          ))}
        </ol>

        {canReply && (
          <form className={styles.composer} onSubmit={handleReply}>
            <label htmlFor="staff-reply" className={styles.composerLabel}>
              {t.staff.replyLabel}
            </label>
            <textarea
              id="staff-reply"
              className={styles.composerInput}
              rows={3}
              maxLength={5000}
              placeholder={t.staff.replyPlaceholder}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {reply.status === "error" && (
              <p className={styles.errorText} role="alert">
                {reply.message}
              </p>
            )}
            <div className={styles.composerActions}>
              <button type="submit" className={styles.primaryButton} disabled={!draft.trim() || reply.status === "busy"}>
                {reply.status === "busy" ? t.staff.sending : t.staff.reply}
              </button>
            </div>
          </form>
        )}
      </section>

      <CaseContext detail={detail} />
    </>
  );
}

function StaffMessage({ message, selfId }: { message: CaseMessage; selfId: string }) {
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
    </li>
  );
}

function describeEvent(event: CaseEvent): string {
  const data = event.data as Record<string, unknown>;
  const str = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
  switch (event.type) {
    case "case_assigned":
      return fill(t.staff.events.case_assigned, { agent: str("agentName") || str("agentId") });
    case "status_changed": {
      const from = str("from") as keyof typeof t.staff.status;
      const to = str("to") as keyof typeof t.staff.status;
      return fill(t.staff.events.status_changed, { from: t.staff.status[from] ?? from, to: t.staff.status[to] ?? to });
    }
    default:
      return t.staff.events[event.type];
  }
}

function CaseContext({ detail }: { detail: StaffCaseDetail }) {
  const c = t.staff.context;
  const dash = c.none;
  return (
    <aside className={styles.context} aria-label={c.title}>
      <h3 className={styles.contextTitle}>{c.customer}</h3>
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
        <dt>{c.category}</dt>
        <dd>{t.category[detail.category]}</dd>
        <dt>{c.priority}</dt>
        <dd>{t.staff.priority[detail.priority]}</dd>
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
