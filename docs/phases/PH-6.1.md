# PH-6.1 — In-product notifications
Type: SUBPHASE TECHNICAL PLAN
Status: PLANNED
Parent: `PH-6.md`
Feature context: `../features/FEAT-NOTIFY/CONTEXT.md` (to be created), `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
A customer sees, from anywhere in the host, that something happened on their cases: a badge on the "Suporte" button and a list of notifications ("Nova resposta em SUP-000001", "Precisamos da sua resposta", "Caso resolvido", "Caso encerrado"), each opening the conversation and marked read on open (context §4.4 "responses generate an in-product notification"). Prerequisite: PH-5.4. Out of scope: e-mail (PH-6.2), reminders and outside-hours notices (PH-6.3).

## Affected boundaries and implementation approach
- Contracts: `CustomerNotification { id, caseId, caseReference, kind, createdAt, readAt }`, `NOTIFICATION_KINDS` (`staff_reply`, `waiting_customer`, `resolved`, `closed`, `reminder`, `outside_hours`).
- Schema migration `0012`: `case_notifications` (customer_id, case_id, kind, created_at, read_at) with an index by customer and read state.
- API: `CasesService` records a notification inside the same transaction as the change (public staff message, `waiting_customer`, `resolved`, `closed`) — exactly once per event (RULE-SUP-03); `GET /api/support/notifications?limit=` (own, unread first), `POST /api/support/notifications/read` (`{ ids? }` or all; also called when the customer opens a case). Customer-wide stream events already fire on these changes; the host refreshes the count on them.
- Web: `NotificationsBell` in the host topbar (count badge on the "Suporte" button, list dropdown) → opens the panel on the case; the panel marks that case's notifications read.

## Required behavior, failures and acceptance evidence
- Another customer never sees or marks these notifications (404/empty); staff → 403.
- A staff reply creates one notification even when retried with the same `clientMessageId`; internal notes create none (RULE-SUP-04).
- Opening the case marks its notifications read; the badge drops live.
Acceptance evidence: `../evidence/PH-6.1-verification.md` (to be created).

## Work performed and important decisions
Filled at approval.

## Verification, limitations and context updates
Evidence: `../evidence/PH-6.1-verification.md` (to be created). Limitations: notifications live only in the product (e-mail in PH-6.2).
Context updated at approval: `PH-6.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `../features/FEAT-NOTIFY/CONTEXT.md` (to be created), `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../decisions/DECISION_LOG.md`.
