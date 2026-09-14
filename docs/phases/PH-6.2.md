# PH-6.2 — E-mail notifications through a boundary port
Type: SUBPHASE TECHNICAL PLAN
Status: PLANNED
Parent: `PH-6.md`
Feature context: `../features/FEAT-NOTIFY/CONTEXT.md`, `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`

## Objective, prerequisites and scope
When a reply stays unread for the configured delay, the customer receives an e-mail that brings them back to the authenticated conversation — reference and kind of update only, never message text or financial detail (context §4.4, §10.2) — and can turn these e-mails off. No mail infrastructure exists (BL-002, §13.2), so delivery goes through a boundary port whose only adapter is a labeled simulation that records an inspectable outbox (DEC-0003 discipline). Prerequisite: PH-6.1. Out of scope: e-mail as a reply channel, provider selection (PH-8), staff e-mails.

## Affected boundaries and implementation approach
- Contracts: `EmailNotification { id, caseId, caseReference, kind, toMasked, subject, link, delivery: 'simulated', createdAt }`, `CustomerPreferences { emailNotifications }` + input schema; settings gain `emailDelayMinutes` (0–1440, default 15).
- Boundary: `EmailNotifierPort.send({ to, subject, body })`; `SimulatedEmailNotifier` writes `email_outbox` and logs nothing sensitive; `OrbitRecordsPort.contactEmail(userId)` returns the raw address to the notifier only (the UI keeps seeing the masked one).
- Schema migration `0013`: `email_outbox`, `customer_preferences`, `case_notifications.emailed_at`, `support_settings.email_delay_minutes`.
- API: `NotificationJob` (interval `SUPPORT_NOTIFICATION_INTERVAL_MS`, default 60 000, single-flight) e-mails each unread notification older than the delay once (`emailed_at`), skipping customers who opted out or have no address; `GET/PUT /api/support/preferences`; `GET /api/support/emails` (own outbox, for the labeled evidence surface).
- Web: preference toggle on the customer home ("Receber e-mail quando houver resposta"); a labeled "E-mails simulados" section on the home listing the outbox with the link back.

## Required behavior, failures and acceptance evidence
- An unread notification older than the delay is e-mailed exactly once; a read one is never e-mailed; opting out stops e-mails; a customer without an address gets none (no error).
- The outbox body contains the reference and the link, and never the reply text (e2e negative); customers see only their own outbox; staff → 403.
Acceptance evidence: `../evidence/PH-6.2-verification.md` (to be created).

## Work performed and important decisions
Filled at approval.

## Verification, limitations and context updates
Evidence: `../evidence/PH-6.2-verification.md` (to be created). Limitations: simulated delivery only; the link is the panel's `?case=` deep link on the simulated host.
Context updated at approval: `PH-6.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-NOTIFY/CONTEXT.md`, `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../runbooks/VERIFICATION.md`.
