"use client";

import type { SavedReply } from "@orbit-support/shared";
import { type FormEvent, useEffect, useState } from "react";
import { AttachmentComposer } from "@/features/support/AttachmentComposer";
import { dictionary as t } from "@/i18n";
import { type AttachmentClient, newClientMessageId } from "@/lib/api";
import { type StaffIdentity, staffApi } from "@/lib/staff-api";
import styles from "./staff.module.css";

type SendState = { status: "idle" } | { status: "busy" } | { status: "error"; message: string };

interface StaffComposerProps {
  identity: StaffIdentity;
  caseId: string;
  attachmentClient: AttachmentClient;
  /** Re-read the case and tell the workspace, after a send succeeded. */
  onSent: () => Promise<void>;
}

/**
 * "Reply to customer" and "Internal note" — visibly different actions (context §5.3, RULE-SUP-04). Each mode keeps
 * its own retry key until a send succeeds, so a retried reply or note is stored once (RULE-SUP-03, BL-013); a failed
 * send keeps the text and the attachment chips. Split from `StaffCaseView` (BL-014).
 */
export function StaffComposer({ identity, caseId, attachmentClient, onSent }: StaffComposerProps) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [draft, setDraft] = useState("");
  const [replyKey, setReplyKey] = useState(() => newClientMessageId());
  const [noteKey, setNoteKey] = useState(() => newClientMessageId());
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [attachClearToken, setAttachClearToken] = useState(0);
  const [send, setSend] = useState<SendState>({ status: "idle" });
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  // Saved replies are read once per case view; inserting one only edits the draft (PH-5.3).
  useEffect(() => {
    const controller = new AbortController();
    staffApi
      .listSavedReplies(identity, controller.signal)
      .then(setSavedReplies)
      .catch(() => undefined);
    return () => controller.abort();
  }, [identity]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSend({ status: "busy" });
    try {
      if (mode === "note") {
        await staffApi.postNote(identity, caseId, { body, clientMessageId: noteKey });
        setNoteKey(newClientMessageId());
      } else {
        await staffApi.postMessage(identity, caseId, {
          body,
          clientMessageId: replyKey,
          ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
        });
        setAttachmentIds([]);
        setAttachClearToken((n) => n + 1);
        setReplyKey(newClientMessageId());
      }
      setDraft("");
      await onSent();
      setSend({ status: "idle" });
    } catch (error) {
      console.warn("staff: could not send", error);
      setSend({ status: "error", message: mode === "note" ? t.staff.notes.failed : t.staff.sendFailed });
    }
  }

  return (
    <form className={styles.composer} onSubmit={(event) => void handleSubmit(event)} data-mode={mode}>
      <fieldset className={styles.modeSwitch}>
        <legend className="visually-hidden">{t.staff.notes.modeLabel}</legend>
        <label className={styles.modeOption} data-selected={mode === "reply" ? "true" : "false"}>
          <input type="radio" name="composer-mode" value="reply" checked={mode === "reply"} onChange={() => setMode("reply")} className="visually-hidden" />
          {t.staff.notes.replyMode}
        </label>
        <label className={styles.modeOption} data-selected={mode === "note" ? "true" : "false"} data-note="true">
          <input type="radio" name="composer-mode" value="note" checked={mode === "note"} onChange={() => setMode("note")} className="visually-hidden" />
          {t.staff.notes.noteMode}
        </label>
      </fieldset>
      <label htmlFor="staff-reply" className={styles.composerLabel}>
        {mode === "note" ? t.staff.notes.noteLabel : t.staff.replyLabel}
      </label>
      {mode === "reply" && savedReplies.length > 0 && (
        <select
          className={styles.select}
          aria-label={t.staff.savedReplies.picker}
          value=""
          onChange={(event) => {
            const chosen = savedReplies.find((r) => r.id === event.target.value);
            if (chosen) setDraft((current) => (current.trim() ? `${current}\n${chosen.body}` : chosen.body));
          }}
        >
          <option value="">{t.staff.savedReplies.pickerNone}</option>
          {savedReplies.map((reply) => (
            <option key={reply.id} value={reply.id}>
              {reply.title}
            </option>
          ))}
        </select>
      )}
      <textarea
        id="staff-reply"
        className={styles.composerInput}
        rows={3}
        maxLength={5000}
        placeholder={mode === "note" ? t.staff.notes.notePlaceholder : t.staff.replyPlaceholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {send.status === "error" && (
        <p className={styles.errorText} role="alert">
          {send.message}
        </p>
      )}
      {mode === "reply" && <AttachmentComposer client={attachmentClient} onReadyChange={setAttachmentIds} clearToken={attachClearToken} idPrefix="staff-attach" />}
      <div className={styles.composerActions}>
        <button type="submit" className={mode === "note" ? styles.noteButton : styles.primaryButton} disabled={!draft.trim() || send.status === "busy"}>
          {send.status === "busy" ? (mode === "note" ? t.staff.notes.saving : t.staff.sending) : mode === "note" ? t.staff.notes.save : t.staff.reply}
        </button>
      </div>
    </form>
  );
}
