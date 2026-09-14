"use client";

import { type AccessRecoveryReceipt, accessRecoveryInputSchema } from "@orbit-support/shared";
import { type FormEvent, useState } from "react";
import { dictionary as t, fill, formatMessageTime } from "@/i18n";
import { ApiError, newClientMessageId, publicApi } from "@/lib/api";
import shellStyles from "@/features/shell/shell.module.css";
import styles from "./access.module.css";

interface AccessRecoveryFormProps {
  onClose: () => void;
}

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "done"; receipt: AccessRecoveryReceipt } | { kind: "error"; text: string };

/**
 * "Não consigo acessar minha conta" (PH-7.1, context §4.5, §14 item 8): reachable without any session, asks for
 * an unverified contact and a description, never for a password or code, and answers with a reference and the
 * next step. Nothing about any account is shown or looked up (RULE-SUP-01).
 */
export function AccessRecoveryForm({ onClose }: AccessRecoveryFormProps) {
  const a = t.access;
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // One id per form: a retry after a network failure never creates a second request (RULE-SUP-03).
  const [clientRequestId] = useState(() => newClientMessageId());

  const parsed = accessRecoveryInputSchema.safeParse({ contact, description, clientRequestId });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success) return;
    setStatus({ kind: "busy" });
    try {
      const receipt = await publicApi.requestAccessRecovery(parsed.data);
      setStatus({ kind: "done", receipt });
    } catch (error) {
      console.warn("access: could not send the recovery request", error);
      if (error instanceof ApiError && error.status === 429) {
        const body = error.body as { retryAfterSeconds?: number } | null;
        const minutes = Math.max(1, Math.ceil((body?.retryAfterSeconds ?? 60) / 60));
        setStatus({ kind: "error", text: fill(a.tooMany, { minutes: String(minutes) }) });
      } else {
        setStatus({ kind: "error", text: a.failed });
      }
    }
  }

  if (status.kind === "done") {
    return (
      <section className={styles.panel} aria-label={a.title} data-testid="access-recovery">
        <h2 className={styles.title}>{a.receiptTitle}</h2>
        <div className={styles.receipt} role="status">
          <span className={styles.reference} data-testid="recovery-reference">
            {status.receipt.reference}
          </span>
          <span>{fill(a.receivedAt, { time: formatMessageTime(status.receipt.receivedAt) })}</span>
          <span>{a.nextStep}</span>
          <span className={styles.hint}>
            <span className={shellStyles.simBadge}>{t.app.simulationBadge}</span> {a.simulation}
          </span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={shellStyles.helpButton} onClick={onClose}>
            {a.back}
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className={styles.panel} onSubmit={submit} noValidate aria-label={a.title} data-testid="access-recovery">
      <h2 className={styles.title}>{a.title}</h2>
      <p className={styles.intro}>{a.intro}</p>
      <p className={styles.notice} role="note">
        {a.noSecrets}
      </p>
      <label className={styles.label} htmlFor="recovery-contact">
        {a.contact}
        <input id="recovery-contact" className={styles.input} value={contact} onChange={(event) => setContact(event.target.value)} autoComplete="off" inputMode="email" maxLength={120} />
        <span className={styles.hint}>{a.contactHint}</span>
      </label>
      <label className={styles.label} htmlFor="recovery-description">
        {a.description}
        <textarea id="recovery-description" className={styles.textarea} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} />
        <span className={styles.hint}>{a.descriptionHint}</span>
      </label>
      {status.kind === "error" && (
        <p className={styles.error} role="alert">
          {status.text}
        </p>
      )}
      <div className={styles.actions}>
        <button type="submit" className={shellStyles.supportButton} disabled={!parsed.success || status.kind === "busy"}>
          {status.kind === "busy" ? a.sending : a.submit}
        </button>
        <button type="button" className={shellStyles.helpButton} onClick={onClose}>
          {a.cancel}
        </button>
      </div>
      <p className={styles.hint}>
        <span className={shellStyles.simBadge}>{t.app.simulationBadge}</span> {a.simulation}
      </p>
    </form>
  );
}
