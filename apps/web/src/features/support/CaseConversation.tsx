"use client";

import { type CaseMessage, type CustomerCaseDetail, isStreamEvent } from "@orbit-support/shared";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { dictionary as t, formatMessageTime } from "@/i18n";
import { type CustomerIdentity, customerApi, customerIdentityHeaders, newClientMessageId } from "@/lib/api";
import { type StreamStatus, subscribeStream } from "@/lib/sse";
import { StatusBadge } from "./StatusBadge";
import styles from "./support.module.css";

/** Safety-net refresh while the live stream is down (ADR-0004). */
export const REFRESH_INTERVAL_MS = 5000;
/** Safety-net refresh while the live stream is connected. */
export const CONNECTED_REFRESH_INTERVAL_MS = 60_000;

interface CaseConversationProps {
  identity: CustomerIdentity;
  caseId: string;
}

/** A message the customer typed that the server has not confirmed yet, or that failed to send. */
export interface PendingMessage {
  clientMessageId: string;
  body: string;
  createdAt: string;
  state: "sending" | "failed";
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; detail: CustomerCaseDetail };

export function CaseConversation({ identity, caseId }: CaseConversationProps) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const logRef = useRef<HTMLOListElement>(null);
  // Monotonic request counter: a poll that started before a send must not overwrite the sent message.
  const requestSeq = useRef(0);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const id = ++requestSeq.current;
      try {
        const detail = await customerApi.getCase(identity, caseId, signal);
        if (id !== requestSeq.current) return; // superseded by a newer request
        setLoad({ status: "ready", detail });
        // Anything the server now knows about is no longer pending.
        setPending((current) =>
          current.filter((p) => !detail.messages.some((m) => m.clientMessageId === p.clientMessageId)),
        );
      } catch (error: unknown) {
        if (signal?.aborted || id !== requestSeq.current) return;
        console.warn("support: could not load case", error);
        setLoad((current) => (current.status === "ready" ? current : { status: "error" }));
      }
    },
    [identity, caseId],
  );

  const pollMs = streamStatus === "connected" ? CONNECTED_REFRESH_INTERVAL_MS : REFRESH_INTERVAL_MS;
  useEffect(() => {
    const controller = new AbortController();
    // The effect only subscribes: the first read and every tick run as callbacks, never synchronously here.
    queueMicrotask(() => void refresh(controller.signal));
    const timer = setInterval(() => void refresh(controller.signal), pollMs);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh, pollMs]);

  // Live updates (ADR-0004): apply new messages at once, re-read on other changes, resync on every (re)connect.
  useEffect(() => {
    const stop = subscribeStream(`/support/cases/${caseId}/stream`, customerIdentityHeaders(identity), {
      onEvent: (_type, data) => {
        if (!isStreamEvent(data) || data.type === "heartbeat" || data.caseId !== caseId) return;
        if (data.type === "message.created") {
          const incoming = data.message;
          requestSeq.current += 1; // a poll that started before this message must not undo it
          setLoad((current) =>
            current.status === "ready" && !current.detail.messages.some((m) => m.id === incoming.id)
              ? { status: "ready", detail: { ...current.detail, messages: [...current.detail.messages, incoming] } }
              : current,
          );
          setPending((current) => current.filter((p) => p.clientMessageId !== incoming.clientMessageId));
        } else if (data.type === "case.updated") {
          void refresh();
        }
      },
      onStatus: (status) => {
        setStreamStatus(status);
        if (status === "connected") void refresh();
      },
    });
    return stop;
  }, [identity, caseId, refresh]);

  useEffect(() => {
    // Keep the newest entry in view; jsdom has no scrollIntoView, hence the optional call.
    logRef.current?.lastElementChild?.scrollIntoView?.({ block: "end" });
  }, [load, pending]);

  async function send(message: PendingMessage) {
    setPending((current) => [...current.filter((p) => p.clientMessageId !== message.clientMessageId), { ...message, state: "sending" }]);
    try {
      const saved = await customerApi.postMessage(identity, caseId, {
        body: message.body,
        clientMessageId: message.clientMessageId,
      });
      setLoad((current) =>
        current.status === "ready" && !current.detail.messages.some((m) => m.id === saved.id)
          ? { status: "ready", detail: { ...current.detail, messages: [...current.detail.messages, saved] } }
          : current,
      );
      setPending((current) => current.filter((p) => p.clientMessageId !== message.clientMessageId));
      // Re-read so status changes made by the server (e.g. reopening) show up and stale polls are superseded.
      await refresh();
    } catch (error) {
      console.warn("support: could not send message", error);
      setPending((current) =>
        current.map((p) => (p.clientMessageId === message.clientMessageId ? { ...p, state: "failed" } : p)),
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    void send({ clientMessageId: newClientMessageId(), body, createdAt: new Date().toISOString(), state: "sending" });
  }

  if (load.status === "loading") {
    return (
      <div className={styles.body}>
        <p className={styles.muted} role="status">
          {t.support.conversation.loading}
        </p>
      </div>
    );
  }
  if (load.status === "error") {
    return (
      <div className={styles.body}>
        <p className={styles.errorText} role="alert">
          {t.support.conversation.error}
        </p>
      </div>
    );
  }

  const { detail } = load;
  const closed = detail.status === "closed";

  return (
    <div className={styles.conversation}>
      <div className={styles.caseHeader}>
        <div className={styles.caseHeaderTop}>
          <span className={styles.caseReference}>
            {t.support.conversation.reference} {detail.reference}
          </span>
          <StatusBadge status={detail.status} />
        </div>
        <p className={styles.caseHeaderSubject}>{detail.subject}</p>
      </div>

      <ol ref={logRef} className={styles.messageLog} aria-live="polite" aria-relevant="additions">
        {detail.messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {pending.map((p) => (
          <li key={p.clientMessageId} className={styles.messageRowMine} data-state={p.state}>
            <div className={styles.bubbleMine}>
              <p className={styles.bubbleBody}>{p.body}</p>
              <span className={styles.bubbleMeta}>
                {p.state === "sending" ? (
                  t.support.conversation.sending
                ) : (
                  <>
                    <span className={styles.failedLabel}>{t.support.conversation.failed}</span>{" "}
                    <button type="button" className={styles.linkButton} onClick={() => void send(p)}>
                      {t.support.conversation.retry}
                    </button>
                  </>
                )}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {detail.status === "new" && pending.length === 0 && (
        <p className={styles.notice}>{t.support.conversation.waitingNotice}</p>
      )}

      {closed ? (
        <p className={styles.notice} role="status">
          {t.support.conversation.closedNotice}
        </p>
      ) : (
        <form className={styles.composer} onSubmit={handleSubmit}>
          <label htmlFor="composer-input" className="visually-hidden">
            {t.support.conversation.composerLabel}
          </label>
          <textarea
            id="composer-input"
            className={styles.composerInput}
            rows={2}
            maxLength={5000}
            placeholder={t.support.conversation.composerPlaceholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" className={styles.primaryButton} disabled={!draft.trim()}>
            {t.support.conversation.send}
          </button>
        </form>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: CaseMessage }) {
  const mine = message.authorType === "customer";
  const author =
    message.authorType === "customer"
      ? t.support.conversation.you
      : message.authorType === "staff"
        ? message.authorName ?? t.support.conversation.support
        : t.support.conversation.system;
  return (
    <li className={mine ? styles.messageRowMine : styles.messageRow} data-author={message.authorType}>
      <div className={mine ? styles.bubbleMine : styles.bubble}>
        {!mine && <span className={styles.bubbleAuthor}>{author}</span>}
        <p className={styles.bubbleBody}>{message.body}</p>
        <span className={styles.bubbleMeta}>
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
        </span>
      </div>
    </li>
  );
}
