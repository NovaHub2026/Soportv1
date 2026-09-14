"use client";

import type { CaseMessage } from "@orbit-support/shared";
import { AttachmentList } from "@/features/support/AttachmentList";
import { dictionary as t, formatMessageTime } from "@/i18n";
import type { AttachmentClient } from "@/lib/api";
import { systemMessageText } from "@/lib/system-messages";
import styles from "./staff.module.css";

/** One message of the staff conversation; internal notes are visibly marked (RULE-SUP-04). Split from `StaffCaseView` (BL-014). */
export function StaffMessage({ message, selfId, attachmentClient }: { message: CaseMessage; selfId: string; attachmentClient: AttachmentClient }) {
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
      <p className={styles.messageBody}>{systemMessageText(message)}</p>
      <AttachmentList attachments={message.attachments} client={attachmentClient} />
    </li>
  );
}
