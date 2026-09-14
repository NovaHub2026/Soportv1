# Notifications and availability
Type: FEATURE CONTEXT
Feature ID: FEAT-NOTIFY
Lifecycle: PARTIAL
Freshness: CURRENT
Verified against: the PH-6.2 commit plus the PH-6.3 change (outside-hours notice, reminders)
Verified on: 2026-09-14
Scope: `apps/api/src/cases/notifications.service.ts`, `notifications.controller.ts`, `email-notifier.ts`, `notification.job.ts`, `preferences.controller.ts`; `case_notifications`, `email_outbox`, `customer_preferences` in `apps/api/src/database/schema.ts`; `apps/web/src/features/shell/NotificationsBell.tsx`; the preference and outbox section of `apps/web/src/features/support/SupportHome.tsx`; copy under `support.notifications` / `support.emails`; availability copy is owned by FEAT-CHAT (PH-5.4) and the schedule by FEAT-STAFF

## User outcome and applicable product rules
A customer learns that support acted on their case even with the panel closed — in the product now, by e-mail later (PH-6.2) — and is told honestly when support is outside its hours (PH-6.3); reminders keep matters waiting on the customer from dying silently (`PROJECT_CONTEXT.md` §4.4, §7.4, OBJ-SUP-04).
Rules: RULE-SUP-01/-04 (notifications carry the kind and the case reference only — never message text, notes or record data), RULE-SUP-03 (exactly one notification per event), RULE-SUP-08 (availability and outside-hours copy from the configured schedule, no promised response time), §14 (automated notices never count as a human response in metrics).

## Current behavior and known gaps
Implemented (PH-6.1, DEC-0024):
- `case_notifications` rows are written inside the same transaction as the customer-facing change: public staff reply (`staff_reply`), status set to waiting for the customer (`waiting_customer`), resolution (`resolved`), closure by staff or by the follow-up window (`closed`). Internal notes, consultations, transfers and incident work create none. A retried reply with the same `clientMessageId` creates none (the duplicate returns before the transaction).
- `GET /api/support/notifications?limit=` → `{ notifications (unread first, newest first), unread }`; `POST /api/support/notifications/read` `{ ids? | caseId? }` or everything; own rows only (another customer's ids mark nothing). Opening a conversation (`POST /support/cases/:id/read`) marks that case's notifications read.
- Host: "Notificações" button with an unread badge and a list ("Nova resposta em SUP-…", "Precisamos da sua resposta…", "… foi marcado como resolvido", "… foi encerrado"); clicking opens the panel on the case; the count refreshes live over the customer-wide stream.
E-mail (PH-6.2, DEC-0025): `NotificationJob` e-mails each unread notification once after `emailDelayMinutes` through `EmailNotifierPort`; the simulated adapter writes `email_outbox` (masked address, subject with the reference, link `/?case=<id>`, no content); customers opt out through `PUT /api/support/preferences`; the home shows the preference and the labeled "E-mails que seriam enviados" list (`GET /api/support/emails`).
Outside hours and reminders (PH-6.3, DEC-0026): a case created or a customer message sent while the configured schedule says closed gets a `system` message "Fora do horário de atendimento. Registramos sua mensagem…" with the next opening (once per case per 12 h) and an `outside_hours` notification; `ReminderJob` (`apps/api/src/cases/reminder.job.ts`) sends one `reminder` notification per waiting-for-customer period after `reminderAfterHours`, recorded as `reminder_sent`; a customer reply resets the period. Neither counts as a human response in metrics.
Not implemented: a real mail provider (PH-8), staff notifications beyond the workspace's own badges. PH-6 approved 2026-09-14 (`docs/evidence/PH-6-phase-approval.md`).

## Dependencies and consumers
Depends on: FEAT-CASE transactions (notifications are recorded by `CasesService`), FEAT-CHAT streams (`/api/support/cases/stream`), the customer projection (DEC-0015). Used by: the Orbit host shell (badge), future e-mail delivery (PH-6.2 reads unread notifications older than the configured delay).

## Where to work
- Recording: the `notifications.record(tx, …)` calls in `apps/api/src/cases/cases.service.ts` (`insertStaffMessage`, `setStatus`, `resolve`, `closeRow`); marking: `markCustomerRead`.
- Reading/marking: `apps/api/src/cases/notifications.service.ts`, `notifications.controller.ts`.
- UI: `apps/web/src/features/shell/NotificationsBell.tsx`, `OrbitShell.tsx` (`openCase` hand-off to `SupportPanel`).
- Tests: `apps/api/src/cases/cases.service.spec.ts` ("in-product notifications"), `apps/api/test/app.e2e-spec.ts` (PH-6.1), `apps/web/src/features/shell/OrbitShell.test.tsx`.

## Important failure and permission behavior
Staff → 403 on the customer notification routes; a customer sees and marks only their own rows (RULE-SUP-01). A notification never contains message content (e2e negative asserts the reply text is absent). If the list request fails the host shows no badge rather than a stale count.

## Decisions and assumptions
DEC-0024 (notification kinds and transactional recording). Assumption: the host hosts the bell; when Orbit hosts the panel for real, the same endpoints feed Orbit's own notification surface.

## Verification and change checklist
Any new customer-facing change in `CasesService` → decide whether it notifies (add a `record` call inside the transaction and a test); copy → dictionary under `support.notifications`. Last scoped evidence: `docs/evidence/PH-6-phase-approval.md`, `docs/evidence/PH-6.3-verification.md`.
