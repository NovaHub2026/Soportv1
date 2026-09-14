"use client";

import { type CaseAttachment, type CaseMessage, type CustomerCaseDetail, isStreamEvent } from "@orbit-support/shared";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { ApiError, apiErrorCode, type AttachmentClient, type CustomerIdentity, customerApi, customerIdentityHeaders, isRetryable, newClientMessageId } from "@/lib/api";
import { type StreamStatus, subscribeStream } from "@/lib/sse";
import { systemMessageText } from "@/lib/system-messages";
import { AttachmentComposer } from "./AttachmentComposer";
import { AttachmentList } from "./AttachmentList";
import { ConnectionIndicator } from "./ConnectionIndicator";
import { RecordCard } from "./RecordCard";
import { StatusBadge } from "./StatusBadge";
import styles from "./support.module.css";

/** Safety-net refresh while the live stream is down (ADR-0004). */
export const REFRESH_INTERVAL_MS = 5000;
/** Safety-net refresh while the live stream is connected. */
export const CONNECTED_REFRESH_INTERVAL_MS = 60_000;
/** Failed messages are retried on reconnect, on the browser's `online` event and, as a fallback, on this cadence. */
export const FAILED_RETRY_INTERVAL_MS = 15_000;

interface CaseConversationProps {
  identity: CustomerIdentity;
  caseId: string;
  /** Navigate to another case of this customer (a follow-up just opened, or the previous case of one). */
  onOpenCase?: (caseId: string) => void;
  /** False while the panel is mounted but hidden (mobile layout): nothing is marked as read then (FND-0021). */
  visible?: boolean;
}

/**
 * A message the customer typed that the server has not confirmed yet, that failed to send (retried
 * automatically), or that the server refused (kept on screen until the customer discards it — RULE-SUP-03).
 */
export interface PendingMessage {
  clientMessageId: string;
  body: string;
  createdAt: string;
  state: "sending" | "failed" | "refused";
  attachmentIds?: string[];
  /** File names shown on the row until the server confirms the message (BL-013, FND-0024). */
  attachmentNames?: string[];
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; detail: CustomerCaseDetail };

const pageVisible = () => typeof document === "undefined" || document.visibilityState === "visible";

/** Unsent messages survive "Voltar", a reload or a closed tab within the session (FND-0012). Per customer and case. */
const pendingStorageKey = (customerId: string, caseId: string) => `orbit-support.pending.${customerId}.${caseId}`;

function readPending(key: string): PendingMessage[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingMessage[];
    // Whatever was "sending" when the page went away is unconfirmed: retry it, the same id keeps it single.
    return parsed.map((p) => (p.state === "sending" ? { ...p, state: "failed" } : p));
  } catch {
    return [];
  }
}

function writePending(key: string, pending: PendingMessage[]): void {
  try {
    if (pending.length === 0) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(pending));
  } catch {
    // Storage unavailable: the in-memory list still works for this mount.
  }
}

export function CaseConversation({ identity, caseId, onOpenCase, visible = true }: CaseConversationProps) {
  const storageKey = pendingStorageKey(identity.customerId, caseId);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [pending, setPending] = useState<PendingMessage[]>(() => (typeof window === "undefined" ? [] : readPending(storageKey)));
  const [movedToFollowUp, setMovedToFollowUp] = useState(false);
  const [draft, setDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [followUp, setFollowUp] = useState<{ status: "idle" } | { status: "sending" } | { status: "error" }>({ status: "idle" });
  const [followUpClientId, setFollowUpClientId] = useState(() => newClientMessageId());
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  // Stable identity: the composer reports again whenever this callback changes.
  const onAttachmentsReady = useCallback((ids: string[], ready: CaseAttachment[]) => {
    setAttachmentIds(ids);
    setAttachmentNames(ready.map((a) => a.fileName));
  }, []);
  const [attachClearToken, setAttachClearToken] = useState(0);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const logRef = useRef<HTMLOListElement>(null);
  const attachmentClient = useMemo(() => customerApi.attachments(identity, caseId), [identity, caseId]);
  // Monotonic request counter: a poll that started before a send must not overwrite the sent message.
  const requestSeq = useRef(0);
  // Mirror of `pending` for callbacks that must not close over stale state (auto-retry on reconnect).
  const pendingRef = useRef<PendingMessage[]>([]);
  useEffect(() => {
    pendingRef.current = pending;
    writePending(storageKey, pending);
  }, [pending, storageKey]);
  // The case is no longer reachable for this identity (404/401/403): stop polling and show nothing of it.
  const unavailable = useRef(false);

  /** Tell the server what was read; only while the conversation is actually on screen (§4.3, FND-0021). */
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);
  const markRead = useCallback(() => {
    if (!pageVisible() || !visibleRef.current) return;
    customerApi.markRead(identity, caseId).then(
      () => setLoad((current) => (current.status === "ready" ? { status: "ready", detail: { ...current.detail, unreadCount: 0 } } : current)),
      (error: unknown) => console.warn("support: could not mark read", error),
    );
  }, [identity, caseId]);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (unavailable.current) return;
      const id = ++requestSeq.current;
      try {
        const detail = await customerApi.getCase(identity, caseId, signal);
        if (id !== requestSeq.current) return; // superseded by a newer request
        setLoad({ status: "ready", detail });
        // Anything the server now knows about is no longer pending.
        setPending((current) =>
          current.filter((p) => !detail.messages.some((m) => m.clientMessageId === p.clientMessageId)),
        );
        if (detail.unreadCount > 0) markRead();
      } catch (error: unknown) {
        if (signal?.aborted || id !== requestSeq.current) return;
        console.warn("support: could not load case", error);
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          // Not this customer's case (any more): never keep a loaded conversation on screen (RULE-SUP-01, FND-0011).
          unavailable.current = true;
          // The mirror is emptied now, not after the next render: a retry trigger in between must find nothing to send (PH-9.2).
          pendingRef.current = [];
          setLoad({ status: "error" });
          setPending([]);
          return;
        }
        setLoad((current) => (current.status === "ready" ? current : { status: "error" }));
      }
    },
    [identity, caseId, markRead],
  );

  // Coming back on screen with unread replies counts as reading them.
  useEffect(() => {
    if (visible && load.status === "ready" && load.detail.unreadCount > 0) markRead();
  }, [visible, load, markRead]);

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

  const send = useCallback(
    async (message: PendingMessage) => {
      // A case that is no longer this customer's takes nothing more, not even a retry (RULE-SUP-01, FND-0011).
      if (unavailable.current) return;
      setPending((current) => [...current.filter((p) => p.clientMessageId !== message.clientMessageId), { ...message, state: "sending" }]);
      try {
        const saved = await customerApi.postMessage(identity, caseId, {
          body: message.body,
          clientMessageId: message.clientMessageId,
          ...(message.attachmentIds && message.attachmentIds.length > 0 ? { attachmentIds: message.attachmentIds } : {}),
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
        if (unavailable.current) return;
        if (apiErrorCode(error) === "case_closed") {
          // The case closed before the message arrived (§7.4): the text moves to the follow-up form, and the
          // same client id keeps the follow-up single if this is retried too.
          setPending((current) => current.filter((p) => p.clientMessageId !== message.clientMessageId));
          setFollowUpDraft((current) => (current.trim() ? `${current}\n${message.body}` : message.body));
          setFollowUpClientId(message.clientMessageId);
          setMovedToFollowUp(true);
          await refresh();
          return;
        }
        const state: PendingMessage["state"] = isRetryable(error) ? "failed" : "refused";
        setPending((current) => current.map((p) => (p.clientMessageId === message.clientMessageId ? { ...p, state } : p)));
      }
    },
    [identity, caseId, refresh],
  );

  /** Resend everything that failed; the same clientMessageId keeps each message single (RULE-SUP-03). */
  const retryFailed = useCallback(() => {
    if (unavailable.current) return;
    for (const failed of pendingRef.current.filter((p) => p.state === "failed")) void send(failed);
  }, [send]);

  const discard = useCallback((clientMessageId: string) => {
    setPending((current) => current.filter((p) => p.clientMessageId !== clientMessageId));
  }, []);

  // Connectivity can return without the stream noticing right away: also retry on `online` and periodically.
  useEffect(() => {
    window.addEventListener("online", retryFailed);
    const timer = setInterval(() => {
      if (typeof navigator === "undefined" || navigator.onLine) retryFailed();
    }, FAILED_RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", retryFailed);
      clearInterval(timer);
    };
  }, [retryFailed]);

  // Live updates (ADR-0004): apply new messages at once, re-read on other changes, resync on every (re)connect
  // and retry what failed while offline (RULE-SUP-03) — the same clientMessageId keeps it single.
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
          if (incoming.authorType !== "customer") markRead();
        } else if (data.type === "case.updated") {
          void refresh();
        }
      },
      onStatus: (status) => {
        setStreamStatus(status);
        if (status === "connected") {
          void refresh();
          retryFailed();
        }
      },
    });
    return stop;
  }, [identity, caseId, refresh, retryFailed, markRead]);

  useEffect(() => {
    // Keep the newest entry in view; jsdom has no scrollIntoView, hence the optional call.
    logRef.current?.lastElementChild?.scrollIntoView?.({ block: "end" });
  }, [load, pending]);

  async function handleFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = followUpDraft.trim();
    if (!message) return;
    setFollowUp({ status: "sending" });
    try {
      const created = await customerApi.followUp(identity, caseId, { message, clientMessageId: followUpClientId });
      setFollowUpDraft("");
      setFollowUpClientId(newClientMessageId());
      setFollowUp({ status: "idle" });
      onOpenCase?.(created.id);
    } catch (error) {
      console.warn("support: could not open follow-up", error);
      setFollowUp({ status: "error" });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const ids = attachmentIds;
    const names = attachmentNames;
    setAttachmentIds([]);
    setAttachmentNames([]);
    setAttachClearToken((n) => n + 1);
    void send({ clientMessageId: newClientMessageId(), body, createdAt: new Date().toISOString(), state: "sending", attachmentIds: ids, attachmentNames: names });
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
        <div className={styles.caseHeaderBottom}>
          <p className={styles.caseHeaderSubject}>{detail.subject}</p>
          <ConnectionIndicator status={streamStatus} labels={t.support.connection} />
        </div>
        {detail.parentReference && (
          <p className={styles.followUpLink}>
            {fill(t.support.conversation.followUpOf, { reference: detail.parentReference })}
            {detail.parentCaseId && onOpenCase && (
              <>
                {" · "}
                <button type="button" className={styles.linkButton} onClick={() => onOpenCase(detail.parentCaseId!)}>
                  {t.support.conversation.openPrevious}
                </button>
              </>
            )}
          </p>
        )}
      </div>

      {detail.record && (
        <RecordCard kind={detail.record.kind} reference={detail.record.reference} snapshot={detail.record.snapshot} lookupReason={detail.record.lookupReason} capturedAt={detail.record.capturedAt} testId="case-record" />
      )}

      <ol ref={logRef} className={styles.messageLog} aria-live="polite" aria-relevant="additions">
        {detail.messages.map((m) => (
          <MessageBubble key={m.id} message={m} attachmentClient={attachmentClient} />
        ))}
        {pending.map((p) => (
          <li key={p.clientMessageId} className={styles.messageRowMine} data-state={p.state}>
            <div className={styles.bubbleMine}>
              <p className={styles.bubbleBody}>{p.body}</p>
              {p.attachmentNames && p.attachmentNames.length > 0 && (
                <p className={styles.bubbleMeta} data-testid="pending-attachments">
                  {fill(t.attachments.pendingFiles, { names: p.attachmentNames.join(", ") })}
                </p>
              )}
              <span className={styles.bubbleMeta}>
                {p.state === "sending" ? (
                  t.support.conversation.sending
                ) : p.state === "refused" ? (
                  <>
                    <span className={styles.failedLabel}>{t.support.conversation.refused}</span>{" "}
                    <button type="button" className={styles.linkButton} onClick={() => discard(p.clientMessageId)}>
                      {t.support.conversation.discard}
                    </button>
                  </>
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
      {detail.status === "resolved" && (
        <div className={styles.resolvedNotice} role="status">
          <p>{t.support.conversation.resolvedNotice}</p>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={pending.length > 0}
            onClick={() =>
              void send({
                clientMessageId: newClientMessageId(),
                body: t.support.conversation.stillNeedHelpMessage,
                createdAt: new Date().toISOString(),
                state: "sending",
              })
            }
          >
            {t.support.conversation.stillNeedHelp}
          </button>
        </div>
      )}

      {closed ? (
        <form className={styles.followUpForm} onSubmit={handleFollowUp} aria-label={t.support.conversation.followUpSubmit}>
          <p className={styles.notice} role="status">
            {t.support.conversation.closedNotice}
          </p>
          {movedToFollowUp && (
            <p className={styles.notice} role="status">
              {t.support.conversation.movedToFollowUp}
            </p>
          )}
          <label htmlFor="follow-up-message" className="visually-hidden">
            {t.support.conversation.followUpLabel}
          </label>
          <textarea
            id="follow-up-message"
            className={styles.composerInput}
            rows={3}
            maxLength={5000}
            placeholder={t.support.conversation.followUpPlaceholder}
            value={followUpDraft}
            onChange={(event) => setFollowUpDraft(event.target.value)}
          />
          {followUp.status === "error" && (
            <p className={styles.errorText} role="alert">
              {t.support.conversation.followUpFailed}
            </p>
          )}
          <button type="submit" className={styles.primaryButton} disabled={!followUpDraft.trim() || followUp.status === "sending"}>
            {followUp.status === "sending" ? t.support.conversation.followUpSending : t.support.conversation.followUpSubmit}
          </button>
        </form>
      ) : (
        <form className={styles.composer} onSubmit={handleSubmit}>
          <div className={styles.composerRow}>
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
          </div>
          <AttachmentComposer client={attachmentClient} onReadyChange={onAttachmentsReady} clearToken={attachClearToken} idPrefix="customer-attach" />
        </form>
      )}
    </div>
  );
}

function MessageBubble({ message, attachmentClient }: { message: CaseMessage; attachmentClient: AttachmentClient }) {
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
        <p className={styles.bubbleBody}>{systemMessageText(message)}</p>
        <AttachmentList attachments={message.attachments} client={attachmentClient} />
        <span className={styles.bubbleMeta}>
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
        </span>
      </div>
    </li>
  );
}
