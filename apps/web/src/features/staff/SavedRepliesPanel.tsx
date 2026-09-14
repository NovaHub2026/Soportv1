"use client";

import { CASE_CATEGORIES, type CaseCategory, type SavedReply } from "@orbit-support/shared";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { ApiError } from "@/lib/api";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import styles from "./staff.module.css";

interface SavedRepliesPanelProps {
  identity: StaffIdentity;
  onClose: () => void;
}

type Draft = { title: string; body: string; category: CaseCategory | "" };
const EMPTY: Draft = { title: "", body: "", category: "" };

/** Team-maintained saved replies (PH-5.3): list, create, edit, remove — every change attributed (RULE-SUP-09). */
export function SavedRepliesPanel({ identity, onClose }: SavedRepliesPanelProps) {
  const r = t.staff.savedReplies;
  const [replies, setReplies] = useState<SavedReply[] | null | "error">(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "error"; text: string }>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    staffApi
      .listSavedReplies(identity, controller.signal)
      .then(setReplies)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("staff: could not load saved replies", error);
          setReplies("error"); // a failure is not "no replies yet" (FND-0041)
        }
      });
    return () => controller.abort();
  }, [identity, attempt]);

  function startEdit(reply: SavedReply | null) {
    setEditing(reply ? reply.id : "new");
    setDraft(reply ? { title: reply.title, body: reply.body, category: reply.category ?? "" } : EMPTY);
    setStatus({ kind: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setStatus({ kind: "busy" });
    const input = { title: draft.title.trim(), body: draft.body.trim(), ...(draft.category ? { category: draft.category } : {}) };
    try {
      if (editing === "new") await staffApi.createSavedReply(identity, input);
      else await staffApi.updateSavedReply(identity, editing, input);
      setEditing(null);
      setStatus({ kind: "idle" });
      reload();
    } catch (error) {
      console.warn("staff: could not save reply", error);
      setStatus({ kind: "error", text: error instanceof ApiError && error.status === 403 ? r.forbidden : r.failed });
    }
  }

  async function handleDelete(reply: SavedReply) {
    setStatus({ kind: "busy" });
    try {
      await staffApi.deleteSavedReply(identity, reply.id);
      setConfirming(null);
      setStatus({ kind: "idle" });
      reload();
    } catch (error) {
      console.warn("staff: could not delete reply", error);
      setStatus({ kind: "error", text: error instanceof ApiError && error.status === 403 ? r.forbidden : r.failed });
    }
  }

  return (
    <section className={styles.panelPage} aria-label={r.title}>
      <header className={styles.panelHeader}>
        <h2 className={styles.caseTitle}>{r.title}</h2>
        <div className={styles.composerActions}>
          <button type="button" className={styles.primaryButton} onClick={() => startEdit(null)} disabled={editing !== null}>
            {r.create}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            {r.back}
          </button>
        </div>
      </header>
      <p className={styles.hint}>{r.hint}</p>
      {status.kind === "error" && (
        <p className={styles.errorText} role="alert">
          {status.text}
        </p>
      )}

      {editing !== null && (
        <form className={styles.replyForm} onSubmit={handleSubmit} aria-label={editing === "new" ? r.create : r.edit}>
          <label className={styles.composerLabel} htmlFor="reply-title">
            {r.titleField}
          </label>
          <input id="reply-title" className={styles.searchInput} maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <label className={styles.composerLabel} htmlFor="reply-category">
            {r.categoryField}
          </label>
          <select id="reply-category" className={styles.select} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as CaseCategory | "" })}>
            <option value="">{r.anyCategory}</option>
            {CASE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t.category[category]}
              </option>
            ))}
          </select>
          <label className={styles.composerLabel} htmlFor="reply-body">
            {r.bodyField}
          </label>
          <textarea id="reply-body" className={styles.composerInput} rows={5} maxLength={5000} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
          <div className={styles.composerActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setEditing(null)}>
              {r.cancel}
            </button>
            <button type="submit" className={styles.primaryButton} disabled={!draft.title.trim() || !draft.body.trim() || status.kind === "busy"}>
              {r.save}
            </button>
          </div>
        </form>
      )}

      {replies === null && <p className={styles.muted}>{t.staff.loading}</p>}
      {replies === "error" && (
        <div className={styles.errorBox} role="alert">
          <p>{r.loadFailed}</p>
          <button type="button" className={styles.secondaryButton} onClick={reload}>
            {t.staff.retry}
          </button>
        </div>
      )}
      {Array.isArray(replies) && replies.length === 0 && <p className={styles.muted}>{r.empty}</p>}
      {Array.isArray(replies) && replies.length > 0 && (
        <ul className={styles.replyList}>
          {replies.map((reply) => (
            <li key={reply.id} className={styles.replyItem} data-testid="saved-reply">
              <div className={styles.replyHead}>
                <strong>{reply.title}</strong>
                <span className={styles.consultationMeta}>
                  {reply.category ? `${t.category[reply.category]} · ` : ""}
                  {fill(r.updatedBy, { agent: reply.updatedByName ?? reply.updatedById, time: formatMessageTime(reply.updatedAt) })}
                </span>
              </div>
              <p className={styles.replyBody}>{reply.body}</p>
              {/* Mirrors the API rule: the author or a supervisor may change a reply (PH-5.3); others only use it. */}
              {(reply.createdById === identity.staffId || identity.role !== "agent") && (
                <div className={styles.composerActions}>
                  <button type="button" className={styles.linkButton} onClick={() => startEdit(reply)}>
                    {r.edit}
                  </button>
                  {confirming === reply.id ? (
                    <>
                      <button type="button" className={styles.linkButton} disabled={status.kind === "busy"} onClick={() => void handleDelete(reply)}>
                        {r.confirmRemove}
                      </button>
                      <button type="button" className={styles.linkButton} onClick={() => setConfirming(null)}>
                        {r.cancel}
                      </button>
                    </>
                  ) : (
                    <button type="button" className={styles.linkButton} onClick={() => setConfirming(reply.id)}>
                      {r.remove}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
