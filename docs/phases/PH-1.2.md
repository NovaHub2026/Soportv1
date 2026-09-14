# PH-1.2 — Case domain and API
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-1.md`
Feature context: none yet (FEAT-CASE / FEAT-CHAT / FEAT-STAFF are written in PH-1.5 once the UIs exist)

## Objective, prerequisites and scope
Persist the support matter and expose the HTTP surface the PH-1 journey needs: a customer creates a case with a first message and gets a reference; lists and reads their own cases; posts follow-up messages. Staff list queues, read the full case (including events), take a case and reply. Prerequisite: PH-1.1 gate. Out of scope: UIs (PH-1.3, PH-1.4), full lifecycle/transfers/notes/follow-ups (PH-3), real-time delivery and attachments (PH-2), Orbit record context (PH-4).

## Affected boundaries and implementation approach
- `packages/shared` (`@orbit-support/shared`, new): vocabulary (`CASE_STATUSES`, categories, priorities, visibilities, event types), zod request/response schemas, `formatCaseReference` (`SUP-000001`), `deriveSubject`, simulated-identity header names. Built to `dist/` before the other workspaces (`npm run build:shared`, part of `verify`).
- `apps/api/src/database`: Drizzle schema (`support_cases`, `case_messages`, `case_events`, PostgreSQL enums), PGlite factory with programmatic migrations, `DatabaseModule.forRoot({ dataDir | inMemory })`. Migrations in `apps/api/drizzle/` (ADR-0003).
- `apps/api/src/identity`: `OrbitIdentityPort` (ADR-0002) + `SimulatedOrbitIdentity` reading `x-simulated-*` headers; `CustomerGuard`, `StaffGuard`, `@CurrentActor()`. Every actor carries `source: 'simulated'`.
- `apps/api/src/cases`: `CasesService` (all rules below), `CustomerCasesController` (`/api/support/cases`), `StaffCasesController` (`/api/staff/cases`), `ZodValidationPipe`.
- `GET /api/health` replaces the scaffold hello-world and labels the simulated backing. `configureApp()` shares prefix/CORS/shutdown between `main.ts` and e2e.

## Required behavior, failures and acceptance evidence
- Opening the panel creates nothing; `POST /support/cases` creates case + first public message + `case_created` event (context §4.1).
- Reference is unique, sequential, `SUP-` + 6 digits; subject derived from the first line when omitted.
- Customer sees only their own cases; another customer's id → 404, never 403 (RULE-SUP-01). Internal-visibility messages never appear on the customer surface (RULE-SUP-04).
- Retrying with the same `clientMessageId` returns the existing case/message instead of duplicating (RULE-SUP-03); enforced by a partial unique index per author.
- Staff `take`: assigns, `new → in_progress`, events `case_assigned` + `status_changed`; refused with 409 if owned by someone else; idempotent for the owner. Replying to an unowned case takes it (RULE-SUP-02).
- Customer message on `resolved` → `in_progress` + `case_reopened` (simple §7.2 rule); on `waiting_customer` → `in_progress`; on `closed` → 409 `case_closed` until PH-3 delivers linked follow-ups.
- Unauthenticated → 401; wrong actor kind → 403; invalid body/query/id → 400 with structured issues.
Acceptance evidence: `../evidence/PH-1.2-verification.md`.

## Work performed and important decisions
ADR-0003 (PostgreSQL via Drizzle, PGlite embedded). Decision log DEC-0005 (shared contracts package with zod, built before consumers). Workspaces reordered `packages/*` before `apps/*`.

Known gaps carried to later subphases/phases, deliberately: no `waiting_customer` transition on staff reply (PH-3), no internal-note endpoint (PH-3), no priority/category editing (PH-3), no pagination (PH-5 when volume warrants), identity trusts headers (simulation only; PH-1.5 formalizes labeling and role checks).

## Verification, limitations and context updates
Evidence: `../evidence/PH-1.2-verification.md` — 15 service tests and 5 e2e tests EXECUTED on in-memory PGlite; persisted mode OBSERVED across a real API restart; `npm run verify` EXECUTED on the candidate; CI recorded separately.
Limitations: concurrency races on `clientMessageId` handled by unique index + retry lookup but not load-tested; PGlite is not a server PostgreSQL (ADR-0003 risks).
Context updated: `PH-1.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `../runbooks/VERIFICATION.md`, `../decisions/DECISION_LOG.md`, `../../CLAUDE.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
