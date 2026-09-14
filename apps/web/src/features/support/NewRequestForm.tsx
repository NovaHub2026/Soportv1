"use client";

import { CASE_CATEGORIES, type CaseCategory, type CustomerCaseDetail, createCaseSchema, type OrbitRecordKind, type OrbitRecordListItem } from "@orbit-support/shared";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { dictionary as t, fill } from "@/i18n";
import { ApiError, type CustomerIdentity, customerApi, newClientMessageId } from "@/lib/api";
import { AttachmentComposer } from "./AttachmentComposer";
import { RecordCard } from "./RecordCard";
import styles from "./support.module.css";

interface NewRequestFormProps {
  identity: CustomerIdentity;
  onCreated: (created: CustomerCaseDetail) => void;
  /** Contextual entry: the record the customer asked for help from ("Preciso de ajuda" — §4.2). */
  record?: OrbitRecordListItem | null;
  /** Continue the active case that already exists for the record instead of opening another. */
  onOpenCase?: (caseId: string) => void;
}

/** The topic a record naturally belongs to; the customer can still change it. */
const CATEGORY_BY_KIND: Record<OrbitRecordKind, CaseCategory> = {
  operation: "operations",
  pix_deposit: "deposits_withdrawals",
  withdrawal: "deposits_withdrawals",
};

type SubmitState = { status: "idle" } | { status: "sending" } | { status: "error"; message: string };

/** Short topic + message (context §4.1): no long mandatory form, no asking for ids Orbit already knows. */
export function NewRequestForm({ identity, onCreated, record: initialRecord = null, onOpenCase }: NewRequestFormProps) {
  const [record, setRecord] = useState<OrbitRecordListItem | null>(initialRecord);
  const [category, setCategory] = useState<CaseCategory | null>(initialRecord ? CATEGORY_BY_KIND[initialRecord.kind] : null);
  const [message, setMessage] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const [differentIssue, setDifferentIssue] = useState(false);
  // One id per submission attempt series: a retry after a network failure must not create a second case.
  const [clientMessageId, setClientMessageId] = useState(() => newClientMessageId());
  // Files for the first message (BL-010): uploaded before the case exists and linked by its creation.
  const attachmentClient = useMemo(() => customerApi.stagedAttachments(identity), [identity]);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [attachClearToken, setAttachClearToken] = useState(0);
  const [uploading, setUploading] = useState(false);

  // The active-case flag may be stale (the list was read when the shell loaded): re-read it for this record.
  useEffect(() => {
    if (!initialRecord) return;
    const controller = new AbortController();
    customerApi
      .listRecords(identity, controller.signal)
      .then(({ records }) => {
        if (records.state !== "available") return;
        const fresh = records.data.find((r) => r.kind === initialRecord.kind && r.reference === initialRecord.reference);
        if (fresh) setRecord((current) => (current && current.reference === fresh.reference ? fresh : current));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [identity, initialRecord]);

  const recordRef = record ? { kind: record.kind, reference: record.reference } : undefined;
  const parsed = createCaseSchema.safeParse({ category, message, clientMessageId, ...(recordRef ? { record: recordRef } : {}), ...(attachmentIds.length > 0 ? { attachmentIds } : {}) });
  const canSubmit = parsed.success && submit.status !== "sending" && !uploading;
  const activeCase = record && record.activeCaseId && !differentIssue ? record : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success) {
      setSubmit({ status: "error", message: t.support.newRequest.validation });
      return;
    }
    if (uploading) return;
    setSubmit({ status: "sending" });
    try {
      const created = await customerApi.createCase(identity, parsed.data);
      setClientMessageId(newClientMessageId());
      setAttachmentIds([]);
      setAttachClearToken((n) => n + 1);
      onCreated(created);
    } catch (error) {
      console.warn("support: could not create case", error);
      if (error instanceof ApiError && (error.body as { error?: unknown } | null)?.error === "attachment_not_available") {
        // A file that expired or is gone can never be sent: say so and let the customer attach it again (FND-0093).
        setAttachmentIds([]);
        setAttachClearToken((n) => n + 1);
        setSubmit({ status: "error", message: t.support.newRequest.attachmentGone });
        return;
      }
      setSubmit({ status: "error", message: t.support.newRequest.error });
    }
  }

  return (
    <form className={styles.body} onSubmit={handleSubmit} noValidate>
      <h3 className={styles.formTitle}>{t.support.newRequest.title}</h3>
      {record && (
        <>
          <p className={styles.label}>{t.support.records.about}</p>
          <RecordCard
            kind={record.kind}
            reference={record.reference}
            snapshot={record}
            testId="request-record"
            actions={
              <button type="button" className={styles.linkButton} onClick={() => setRecord(null)}>
                {t.support.records.remove}
              </button>
            }
          />
        </>
      )}
      {initialRecord && !record && <p className={styles.hint}>{t.support.records.removedHint}</p>}
      {activeCase && (
        <div className={styles.resolvedNotice} role="status">
          <p>{fill(t.support.records.activeCase, { reference: activeCase.activeCaseReference ?? "" })}</p>
          <div className={styles.recordActions}>
            {onOpenCase && (
              <button type="button" className={styles.secondaryButton} onClick={() => onOpenCase(activeCase.activeCaseId!)}>
                {t.support.records.continueCase}
              </button>
            )}
            <button type="button" className={styles.linkButton} onClick={() => setDifferentIssue(true)}>
              {t.support.records.differentIssue}
            </button>
          </div>
        </div>
      )}

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
      <AttachmentComposer client={attachmentClient} onReadyChange={setAttachmentIds} onUploadingChange={setUploading} clearToken={attachClearToken} disabled={submit.status === "sending"} idPrefix="new-request-attach" />

      {submit.status === "error" && (
        <p className={styles.errorText} role="alert">
          {submit.message}
        </p>
      )}

      <button type="submit" className={styles.primaryButton} disabled={!canSubmit || activeCase !== null}>
        {submit.status === "sending" ? t.support.newRequest.sending : t.support.newRequest.send}
      </button>
    </form>
  );
}
