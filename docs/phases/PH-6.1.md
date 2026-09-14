# PH-6.1 — In-product notifications
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-6.md`
Feature context: `../features/FEAT-NOTIFY/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

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
Acceptance evidence: `../evidence/PH-6.1-verification.md`.

## Work performed and important decisions
- Shared: `NOTIFICATION_KINDS`, `CustomerNotification`, `markNotificationsReadSchema`; table `case_notifications` (migration `0012`); `NotificationsService` (record inside transactions, list unread-first, unread count, ownership-scoped marking) and `NotificationsController` (`GET /api/support/notifications`, `POST …/read`).
- `CasesService` records `staff_reply`, `waiting_customer`, `resolved`, `closed` in the same transaction as the change; `markCustomerRead` marks the case's notifications.
- Web: `NotificationsBell` in the host topbar (badge + list, live over the customer-wide stream); `SupportPanel` accepts `openCase` from the host.
- DEC-0024: notifications are transactional side effects of customer-facing case changes, carry kind and reference only, and are read when the conversation is on screen.

## Verification, limitations and context updates
Evidence: `../evidence/PH-6.1-verification.md`. Limitations: notifications live only in the product (e-mail in PH-6.2).
Context updated: `PH-6.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `../features/FEAT-NOTIFY/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../decisions/DECISION_LOG.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
