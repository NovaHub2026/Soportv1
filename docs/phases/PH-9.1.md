# PH-9.1 — Case-domain debt
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-9.md`
Feature context: `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-NOTIFY/CONTEXT.md`

## Objective, prerequisites and scope
Pay the API-side debt the audits carried: BL-022 (Cycle Audit 2 FND-0046, FND-0051), BL-029 (cycle 3 FND-0078), the API half of BL-013 (Cycle Audit 1 FND-0024) and BL-018 (FND-0027). Prerequisite: PH-8. Out of scope: the staff composer's use of the note key (PH-9.2).

## Affected boundaries and implementation approach
- `apps/api/src/cases/case-rules.ts` owns the rules read by more than one service: `awaitingReplySince` and its SQL twin (previously three copies in `cases.service.ts` and `supervision.service.ts`), and `waitingInternalSince(row, oldestOpenConsultation)`.
- `CasesService.remind(caseId, cutoff, afterHours, now)` decides a reminder on the locked row through `mutate` (DEC-0017); `ReminderJob` only selects candidates and no longer owns a `FOR UPDATE` transaction.
- `postNoteSchema.clientMessageId` (optional): a retried note returns the stored one, also under concurrent retries (the existing unique index per case and author); a key the author already used for a public reply → 409 `client_message_id_reused`.
- Supervision: waiting for a team = `waiting_internal` or an open consultation (oldest `requestedAt`), whatever the status; the overdue list holds each case once, at its oldest wait (a case could appear twice before — awaiting a reply and waiting for a team).
- `jobs.spec.ts` drives the three jobs' `tick()` with stubbed work; the e2e suite parses case, message, consultation and queue responses with the shared schemas in strict mode.

## Required behavior, failures and acceptance evidence
- A note retried with the same key (sequentially or concurrently) is stored once; another author's key space is separate; notes without a key behave as before; a reply key replayed as a note is refused.
- A case that left `waiting_customer` before the job reached it is not reminded; one reminder per period; an unknown case → 404.
- A case moved to `in_progress` with an open consultation stays in `waitingInternal.count` and becomes overdue by the consultation's age; answering the consultation removes it.
- The SQL twin and the rule agree on every status; strict schemas refuse a staff summary where a customer summary is expected.
Acceptance evidence: `../evidence/PH-9.1-verification.md`.

## Work performed and important decisions
As planned. DEC-0035 records the waiting-for-team definition, the one-entry overdue list and the refusal of a reply key replayed as a note.

## Verification, limitations and context updates
Evidence: `../evidence/PH-9.1-verification.md`. Limitations: API only, no screen changed (the queue label for a case moved on while a consultation is open still reads its status; supervision counts it); no browser smoke for this subphase.
Context updated: `PH-9.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-NOTIFY/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
