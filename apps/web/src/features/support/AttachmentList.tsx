"use client";

import type { CaseAttachment } from "@orbit-support/shared";
import { useEffect, useState } from "react";
import { dictionary as t, fill, formatBytes } from "@/i18n";
import type { AttachmentClient } from "@/lib/api";
import styles from "./support.module.css";

interface AttachmentListProps {
  attachments: CaseAttachment[];
  client: AttachmentClient;
}

/** Attachments of one message: image thumbnails (fetched with identity, so never a bare `<img src>`) and file chips. */
export function AttachmentList({ attachments, client }: AttachmentListProps) {
  if (attachments.length === 0) return null;
  return (
    <ul className={styles.attachmentList}>
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          {attachment.mimeType.startsWith("image/") ? (
            <ImageAttachment attachment={attachment} client={client} />
          ) : (
            <FileAttachment attachment={attachment} client={client} />
          )}
        </li>
      ))}
    </ul>
  );
}

async function openBlob(client: AttachmentClient, attachment: CaseAttachment) {
  const blob = await client.fetchBlob(attachment.id);
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.fileName;
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function FileAttachment({ attachment, client }: { attachment: CaseAttachment; client: AttachmentClient }) {
  const [error, setError] = useState(false);
  return (
    <div className={styles.fileAttachment} data-status={attachment.status}>
      <span className={styles.fileIcon} aria-hidden="true">
        PDF
      </span>
      <span className={styles.fileName}>{attachment.fileName}</span>
      <span className={styles.attachChipMeta}>{formatBytes(attachment.sizeBytes)}</span>
      {attachment.status === "available" ? (
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => openBlob(client, attachment).catch(() => setError(true))}
        >
          {t.attachments.open}
        </button>
      ) : (
        <span className={styles.attachChipMeta}>{t.attachments.unavailable}</span>
      )}
      {error && <span className={styles.failedLabel}>{t.attachments.unavailable}</span>}
    </div>
  );
}

function ImageAttachment({ attachment, client }: { attachment: CaseAttachment; client: AttachmentClient }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; url: string } | { status: "error" }>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    client
      .fetchBlob(attachment.id, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setState({ status: "ready", url: objectUrl });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("attachments: could not load image", error);
        setState({ status: "error" });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, client]);

  const alt = fill(t.attachments.imageAlt, { name: attachment.fileName });
  if (state.status === "loading") {
    return (
      <div className={styles.imageAttachmentPlaceholder} role="status">
        {t.attachments.loading}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className={styles.imageAttachmentPlaceholder} role="alert">
        {t.attachments.unavailable} · {attachment.fileName}
      </div>
    );
  }
  return (
    <button type="button" className={styles.imageAttachment} onClick={() => openBlob(client, attachment).catch(() => {})} title={attachment.fileName}>
      {/* eslint-disable-next-line @next/next/no-img-element -- blob URL fetched with identity headers */}
      <img src={state.url} alt={alt} className={styles.imageThumb} />
      <span className={styles.attachChipMeta}>
        {attachment.fileName} · {formatBytes(attachment.sizeBytes)}
      </span>
    </button>
  );
}
