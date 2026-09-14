# Case lifecycle
Type: FEATURE CONTEXT
Feature ID: FEAT-CASE
Lifecycle: PARTIAL
Freshness: CURRENT
Verified against: `411f5d9` plus the PH-2.2 change (read markers, unread counts)
Verified on: 2026-09-13
Scope: `packages/shared/src/cases.ts`, `packages/shared/src/stream.ts`, `apps/api/src/cases/`, `apps/api/src/events/`, `apps/api/src/database/schema.ts`, `apps/api/drizzle/`

## User outcome and applicable product rules
A support matter is a persistent **case** with a customer-visible reference, status, category, priority, responsible agent, conversation and attributable history (`PROJECT_CONTEXT.md` §7, OBJ-SUP-03). "Chat" is the communication experience; the case is the managed matter whose status reflects work still required, not whether the panel is open.
Rules: RULE-SUP-02 (every active case in a queue or with a responsible person), RULE-SUP-03 (accepted communication is never silently lost), RULE-SUP-05 (resolving/closing changes no money, results or permissions), RULE-SUP-06 (continue with context preserved), RULE-SUP-09 (material actions attributable, no silent rewrites).

## Current behavior and known gaps
Implemented (PH-1.2):
- Create = case + first public message + `case_created` event; subject derived from the first line when omitted. Reference `SUP-` + six digits from an identity column.
- Statuses: `new`, `in_progress`, `waiting_customer`, `waiting_internal`, `resolved`, `closed`; priority default `normal`; five categories.
- Staff **take**: assigns, `new → in_progress`, events `case_assigned` + `status_changed`; 409 `case_assigned_to_other` if owned by someone else; idempotent for the owner. A staff reply on an unowned case takes it.
- Customer message: on `resolved` → `in_progress` + `case_reopened` (§7.2 simple rule); on `waiting_customer` → `in_progress`; on `closed` → 409 `case_closed`.
- Idempotency: `clientMessageId` unique per author (partial unique index); a retry returns the stored case/message.
- Read markers (PH-2.2): `customer_last_read_at` / `staff_last_read_at` set by `POST /support/cases/:id/read` and `POST /staff/cases/:id/read`; `unreadCount` on every summary/detail = messages from the other side newer than the viewer's marker (customers count only public non-customer messages); `GET /support/cases/stream` covers all of a customer's cases.
- Live events (PH-2.1, ADR-0004): after each committed write the service publishes `case.updated` (with summary) and `message.created` (with message) on the in-process `CaseEventBus`; `GET /support/cases/:id/stream` (ownership checked first, internal messages filtered) and `GET /staff/cases/stream` expose them as SSE with a 15 s heartbeat.
Accepted target, not yet implemented: staff transitions to `waiting_customer` / `waiting_internal`, resolve with reason and customer-facing explanation, transfer, internal-note endpoint, priority/category edits, specialist consultation, linked follow-up from `closed`, the 7-day closure job and shared incidents (PH-3); filters, search, pagination (PH-5); reminders/inactivity policy (PH-6/BL-002).

## Dependencies and consumers
Depends on: database (ADR-0003, `apps/api/src/database/`), actors from FEAT-ORBIT (`CustomerActor`, `StaffActor`).
Used by / affects: FEAT-CHAT (customer endpoints `/api/support/cases*`), FEAT-STAFF (`/api/staff/cases*`), future FEAT-NOTIFY (consumes `case_events`). Shared contract owner: `packages/shared/src/cases.ts` — a change to statuses or categories needs a PostgreSQL enum migration, the pt-BR labels in `apps/web/src/i18n/pt-BR.ts` (customer and staff sets) and the dictionary test. Search consumers with `rg "CASE_STATUSES|OPEN_CASE_STATUSES"` before changing the vocabulary.

## Where to work
- Rules and queries: `apps/api/src/cases/cases.service.ts`. HTTP: `apps/api/src/cases/customer-cases.controller.ts`, `apps/api/src/cases/staff-cases.controller.ts`.
- Schema: `apps/api/src/database/schema.ts` → `npm run db:generate -w api` → commit `apps/api/drizzle/`.
- Contracts and validation: `packages/shared/src/cases.ts` (zod); rebuild with `npm run build:shared`.
- Tests: `apps/api/src/cases/cases.service.spec.ts` (in-memory PGlite), `apps/api/test/app.e2e-spec.ts`, `packages/shared/src/cases.test.ts`.

## Important failure and permission behavior
Customer access is ownership: another customer's case answers 404, never 403 (RULE-SUP-01). Staff endpoints require a staff actor; roles are not differentiated yet. Multi-row writes run in a transaction; a unique violation on `clientMessageId` is caught and the existing record returned. Validation failures are 400 with `validation_failed` and per-field issues.

## Decisions and assumptions
ADR-0003 (PostgreSQL via Drizzle, PGlite for dev/tests), DEC-0005 (shared zod contracts). Assumptions: the reference is an identifier, not a credential (context §6.1); the reactivation rule and the closure window are reversible working defaults (context §13.1) — revisit when Operations defines policy (BL-002).

## Verification and change checklist
Behavior change → `npm test -w api` and `npm run test:e2e -w api`; schema change → regenerate migration, rerun both; contract change → `npm run build:shared`, `npm test -w web`. Phase-level journey → `scripts/ui-smoke.mjs`. Last scoped evidence: `docs/evidence/PH-1.2-verification.md`, `docs/evidence/PH-1.5-verification.md`.
