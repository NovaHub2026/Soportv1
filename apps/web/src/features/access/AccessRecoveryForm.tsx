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
  // One id per request content: a retry of the same text never creates a second request (RULE-SUP-03); editing
  // after a failure makes it a new request, so the edit is not silently replaced by the first receipt (Cycle Audit 3).
  const [clientRequestId, setClientRequestId] = useState(() => newClientMessageId());

  const parsed = accessRecoveryInputSchema.safeParse({ contact, description, clientRequestId });

  const edit = (apply: () => void) => {
    apply();
    if (status.kind === "error") setClientRequestId(newClientMessageId());
  };

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
        const body = error.body as { error?: string; retryAfterSeconds?: number } | null;
        const minutes = String(Math.max(1, Math.ceil((body?.retryAfterSeconds ?? 60) / 60)));
        // "service_busy" is other people's traffic; only "too_many_requests" is about this contact (Cycle Audit 3).
        setStatus({ kind: "error", text: fill(body?.error === "service_busy" ? a.busy : a.tooMany, { minutes }) });
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
      </label>
      <input
        id="recovery-contact"
        className={styles.input}
        value={contact}
        onChange={(event) => edit(() => setContact(event.target.value))}
        autoComplete="off"
        inputMode="email"
        maxLength={120}
        aria-describedby="recovery-contact-hint"
      />
      <span id="recovery-contact-hint" className={styles.hint}>
        {a.contactHint}
      </span>
      <label className={styles.label} htmlFor="recovery-description">
        {a.description}
      </label>
      <textarea
        id="recovery-description"
        className={styles.textarea}
        value={description}
        onChange={(event) => edit(() => setDescription(event.target.value))}
        maxLength={1000}
        aria-describedby="recovery-description-hint"
      />
      <span id="recovery-description-hint" className={styles.hint}>
        {a.descriptionHint}
      </span>
      {status.kind === "error" && (
        <p className={styles.error} role="alert">
          {status.text}
        </p>
      )}
      <div className={styles.actions}>
        <button type="submit" className={shellStyles.supportButton} disabled={!parsed.success || status.kind === "busy"} aria-describedby="recovery-rules">
          {status.kind === "busy" ? a.sending : a.submit}
        </button>
        <button type="button" className={shellStyles.helpButton} onClick={onClose}>
          {a.cancel}
        </button>
      </div>
      <p id="recovery-rules" className={styles.hint}>
        {a.rules}
      </p>
      <p className={styles.hint}>
        <span className={shellStyles.simBadge}>{t.app.simulationBadge}</span> {a.simulation}
      </p>
    </form>
  );
}
