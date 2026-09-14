"use client";

import { ATTACHMENT_LIMITS, type CaseAttachment } from "@orbit-support/shared";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { dictionary as t, formatBytes } from "@/i18n";
import { type AttachmentClient, ApiError } from "@/lib/api";
import styles from "./support.module.css";

export interface UploadItem {
  localId: string;
  name: string;
  size: number;
  state: "uploading" | "ready" | "failed";
  attachment?: CaseAttachment;
  error?: string;
}

interface AttachmentComposerProps {
  client: AttachmentClient;
  /** Called with the ids of uploads that are ready to be linked to the next message, and the uploads themselves (their names label a pending message — BL-013). */
  onReadyChange: (attachmentIds: string[], ready: CaseAttachment[]) => void;
  /** Increment to clear the list (after the message was sent). */
  clearToken: number;
  disabled?: boolean;
  idPrefix?: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 413) return t.attachments.tooLarge;
    if (error.status === 415) return t.attachments.unsupported;
  }
  return t.attachments.uploadFailed;
}

/**
 * Pick files → upload right away → chips with state → the parent links the ready ids when sending
 * (PROJECT_CONTEXT.md §10.2: the user always sees a file's actual state). Limits from the shared contract.
 */
export function AttachmentComposer({ client, onReadyChange, clearToken, disabled = false, idPrefix = "attach" }: AttachmentComposerProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastClear = useRef(clearToken);

  useEffect(() => {
    if (lastClear.current !== clearToken) {
      lastClear.current = clearToken;
      queueMicrotask(() => {
        setItems([]);
        setNotice(null);
      });
    }
  }, [clearToken]);

  useEffect(() => {
    const ready = items.filter((i) => i.state === "ready" && i.attachment).map((i) => i.attachment!);
    onReadyChange(
      ready.map((a) => a.id),
      ready,
    );
  }, [items, onReadyChange]);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const room = ATTACHMENT_LIMITS.maxPerMessage - items.filter((i) => i.state !== "failed").length;
    if (files.length > room) {
      setNotice(t.attachments.tooMany);
      files.splice(room);
    } else {
      setNotice(null);
    }
    for (const file of files) {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (file.size > ATTACHMENT_LIMITS.maxBytes) {
        setItems((current) => [...current, { localId, name: file.name, size: file.size, state: "failed", error: t.attachments.tooLarge }]);
        continue;
      }
      if (file.type && !(ATTACHMENT_LIMITS.allowedMimeTypes as readonly string[]).includes(file.type)) {
        setItems((current) => [...current, { localId, name: file.name, size: file.size, state: "failed", error: t.attachments.unsupported }]);
        continue;
      }
      setItems((current) => [...current, { localId, name: file.name, size: file.size, state: "uploading" }]);
      try {
        const attachment = await client.upload(file);
        setItems((current) => current.map((i) => (i.localId === localId ? { ...i, state: "ready", attachment } : i)));
      } catch (error) {
        console.warn("attachments: upload failed", error);
        setItems((current) => current.map((i) => (i.localId === localId ? { ...i, state: "failed", error: errorMessage(error) } : i)));
      }
    }
  }

  const remove = (localId: string) => setItems((current) => current.filter((i) => i.localId !== localId));
  const inputId = `${idPrefix}-input`;

  return (
    <div className={styles.attachComposer}>
      <div className={styles.attachRow}>
        <label className={styles.attachButton} htmlFor={inputId} aria-disabled={disabled}>
          {t.attachments.attach}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="visually-hidden"
          multiple
          accept={ATTACHMENT_LIMITS.allowedMimeTypes.join(",")}
          onChange={(event) => void handleFiles(event)}
          disabled={disabled}
        />
        <span className={styles.attachHint}>{t.attachments.hint}</span>
      </div>
      {notice && (
        <p className={styles.errorText} role="alert">
          {notice}
        </p>
      )}
      {items.length > 0 && (
        <ul className={styles.attachChips} aria-live="polite">
          {items.map((item) => (
            <li key={item.localId} className={styles.attachChip} data-state={item.state}>
              <span className={styles.attachChipName}>{item.name}</span>
              <span className={styles.attachChipMeta}>
                {item.state === "uploading" && t.attachments.uploading}
                {item.state === "ready" && formatBytes(item.size)}
                {item.state === "failed" && <span className={styles.failedLabel}>{item.error}</span>}
              </span>
              <button type="button" className={styles.linkButton} onClick={() => remove(item.localId)} aria-label={`${t.attachments.remove} ${item.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
