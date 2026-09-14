"use client";

import { CASE_CATEGORIES, type CaseCategory, type CustomerCaseDetail, createCaseSchema } from "@orbit-support/shared";
import { type FormEvent, useState } from "react";
import { dictionary as t } from "@/i18n";
import { type CustomerIdentity, customerApi, newClientMessageId } from "@/lib/api";
import styles from "./support.module.css";

interface NewRequestFormProps {
  identity: CustomerIdentity;
  onCreated: (created: CustomerCaseDetail) => void;
}

type SubmitState = { status: "idle" } | { status: "sending" } | { status: "error"; message: string };

/** Short topic + message (context §4.1): no long mandatory form, no asking for ids Orbit already knows. */
export function NewRequestForm({ identity, onCreated }: NewRequestFormProps) {
  const [category, setCategory] = useState<CaseCategory | null>(null);
  const [message, setMessage] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  // One id per submission attempt series: a retry after a network failure must not create a second case.
  const [clientMessageId, setClientMessageId] = useState(() => newClientMessageId());

  const parsed = createCaseSchema.safeParse({ category, message, clientMessageId });
  const canSubmit = parsed.success && submit.status !== "sending";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success) {
      setSubmit({ status: "error", message: t.support.newRequest.validation });
      return;
    }
    setSubmit({ status: "sending" });
    try {
      const created = await customerApi.createCase(identity, parsed.data);
      setClientMessageId(newClientMessageId());
      onCreated(created);
    } catch (error) {
      console.warn("support: could not create case", error);
      setSubmit({ status: "error", message: t.support.newRequest.error });
    }
  }

  return (
    <form className={styles.body} onSubmit={handleSubmit} noValidate>
      <h3 className={styles.formTitle}>{t.support.newRequest.title}</h3>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>{t.support.newRequest.topic}</legend>
        <div className={styles.chips}>
          {CASE_CATEGORIES.map((value) => (
            <label key={value} className={styles.chip} data-selected={category === value ? "true" : "false"}>
              <input
                type="radio"
                name="category"
                value={value}
                checked={category === value}
                onChange={() => setCategory(value)}
                className="visually-hidden"
              />
              {t.category[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={styles.label} htmlFor="new-request-message">
        {t.support.newRequest.message}
      </label>
      <textarea
        id="new-request-message"
        className={styles.textarea}
        rows={5}
        maxLength={5000}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        aria-describedby="new-request-hint"
      />
      <p id="new-request-hint" className={styles.hint}>
        {t.support.newRequest.messageHint}
      </p>

      {submit.status === "error" && (
        <p className={styles.errorText} role="alert">
          {submit.message}
        </p>
      )}

      <button type="submit" className={styles.primaryButton} disabled={!canSubmit}>
        {submit.status === "sending" ? t.support.newRequest.sending : t.support.newRequest.send}
      </button>
    </form>
  );
}
