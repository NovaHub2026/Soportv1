# PH-6.3 — Outside-hours notice, reminders, phase closure
Type: SUBPHASE TECHNICAL PLAN
Status: PLANNED
Parent: `PH-6.md`
Feature context: `../features/FEAT-NOTIFY/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`

## Objective, prerequisites and scope
A customer who writes while support is closed is told so in the conversation, with the next attention period, and their message is kept (context §4.4); a case waiting for the customer receives one reminder after the configured delay instead of dying silently (§7.4); none of these automated notices counts as a human response (§14). Prerequisites: PH-6.1, PH-6.2. Out of scope: staff nudges beyond the supervision overview, inactivity auto-resolution (§7.4 forbids treating silence as a solution).

## Affected boundaries and implementation approach
- Settings gain `reminderAfterHours` (1–720, default 48); `support_cases` gain `outside_hours_notified_at` and `reminder_sent_at`; event type `reminder_sent`; migration `0014`.
- `CasesService`: after a case is created or a customer message committed while `computeAvailability(settings)` says closed, a system message "Fora do horário de atendimento. Registramos sua mensagem; próximo atendimento: <dia> às <hora>." is posted once per case per 12 h (`outside_hours_notified_at`) with an `outside_hours` notification; a customer reply that leaves `waiting_customer` clears `reminder_sent_at`.
- `ReminderJob` (interval `SUPPORT_REMINDER_INTERVAL_MS`, default 60 000, single-flight, `SUPPORT_REMINDER_JOB=off`): for `waiting_customer` cases whose wait (latest staff reply or status change) is older than the delay and `reminder_sent_at` is null → `reminder` notification (e-mailed by the existing job if unread and enabled), `reminder_sent` event, `reminder_sent_at` set; never touches resolved or closed cases.
- Metrics: first-response counts public staff messages only — a test proves a system notice does not count.

## Required behavior, failures and acceptance evidence
- Notice posted exactly once for consecutive customer messages within 12 h; not posted when support is open; visible to staff as a system message, never as a staff reply.
- Reminder sent once per waiting period; a customer reply resets it; closed parents of follow-ups get none.
Acceptance evidence: `../evidence/PH-6.3-verification.md` (to be created); phase evidence `../evidence/PH-6-phase-approval.md` (to be created).

## Work performed and important decisions
Filled at approval.

## Verification, limitations and context updates
Evidence: `../evidence/PH-6.3-verification.md` (to be created). Limitations: the reminder is exercised at unit/e2e level (hours cannot elapse in the smoke); the 12 h notice window is a working default.
Context updated at approval: `PH-6.md`, `ROADMAP.md` (ledger 3/3, Cycle Audit 2 opened), `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-NOTIFY/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../runbooks/VERIFICATION.md`, `../audits/CYCLE-2.md` (to be created).
