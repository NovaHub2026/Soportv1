# Notifications and availability
Type: FEATURE CONTEXT
Feature ID: FEAT-NOTIFY
Lifecycle: PARTIAL
Freshness: CURRENT
Verified against: `4b868e7` plus the PH-6.1 change (in-product notifications)
Verified on: 2026-09-14
Scope: `apps/api/src/cases/notifications.service.ts`, `apps/api/src/cases/notifications.controller.ts`, `case_notifications` in `apps/api/src/database/schema.ts`, `apps/web/src/features/shell/NotificationsBell.tsx`, notification copy in `apps/web/src/i18n/pt-BR.ts`; availability copy is owned by FEAT-CHAT (PH-5.4) and the schedule by FEAT-STAFF

## User outcome and applicable product rules
A customer learns that support acted on their case even with the panel closed — in the product now, by e-mail later (PH-6.2) — and is told honestly when support is outside its hours (PH-6.3); reminders keep matters waiting on the customer from dying silently (`PROJECT_CONTEXT.md` §4.4, §7.4, OBJ-SUP-04).
Rules: RULE-SUP-01/-04 (notifications carry the kind and the case reference only — never message text, notes or record data), RULE-SUP-03 (exactly one notification per event), RULE-SUP-08 (availability and outside-hours copy from the configured schedule, no promised response time), §14 (automated notices never count as a human response in metrics).

## Current behavior and known gaps
Implemented (PH-6.1, DEC-0024):
- `case_notifications` rows are written inside the same transaction as the customer-facing change: public staff reply (`staff_reply`), status set to waiting for the customer (`waiting_customer`), resolution (`resolved`), closure by staff or by the follow-up window (`closed`). Internal notes, consultations, transfers and incident work create none. A retried reply with the same `clientMessageId` creates none (the duplicate returns before the transaction).
- `GET /api/support/notifications?limit=` → `{ notifications (unread first, newest first), unread }`; `POST /api/support/notifications/read` `{ ids? | caseId? }` or everything; own rows only (another customer's ids mark nothing). Opening a conversation (`POST /support/cases/:id/read`) marks that case's notifications read.
- Host: "Notificações" button with an unread badge and a list ("Nova resposta em SUP-…", "Precisamos da sua resposta…", "… foi marcado como resolvido", "… foi encerrado"); clicking opens the panel on the case; the count refreshes live over the customer-wide stream.
Not implemented: e-mail delivery and preference (PH-6.2), outside-hours notice and reminders (PH-6.3 — kinds `outside_hours` and `reminder` are reserved), staff notifications beyond the workspace's own badges.

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
Any new customer-facing change in `CasesService` → decide whether it notifies (add a `record` call inside the transaction and a test); copy → dictionary under `support.notifications`. Last scoped evidence: `docs/evidence/PH-6.1-verification.md`.
