# Orbit context integration
Type: FEATURE CONTEXT
Feature ID: FEAT-ORBIT
Lifecycle: PARTIAL (identity boundary and customer summary; record cards pending)
Freshness: CURRENT
Verified against: `4c06c5c` plus the PH-4.3 change (not-integrated subjects, outage and not-found flows demonstrated)
Verified on: 2026-09-14
Scope: `apps/api/src/identity/` (incl. `staff-directory.ts`, `orbit-records.ts`, `simulated-orbit-records.ts`), `packages/shared/src/identity.ts`, `packages/shared/src/orbit.ts`, `apps/web/src/lib/simulated-session.ts`, `apps/web/src/features/staff/OrbitCustomerSection.tsx`, identity headers in `apps/web/src/lib/api.ts` and `apps/web/src/lib/staff-api.ts`

## User outcome and applicable product rules
Staff identify the right customer and inspect the records relevant to an issue without asking for information Orbit already holds; customers never type their own ids (`PROJECT_CONTEXT.md` §6, OBJ-SUP-02). Orbit does not exist yet (DEC-0003): today this feature is the **boundary** through which identity — and later records — will arrive, plus its simulated implementation.
Rules: RULE-SUP-01 (knowing an id grants nothing), RULE-SUP-05 (support never gains financial/account authority through this boundary), RULE-SUP-07 (unavailable data is shown as unavailable).

## Current behavior and known gaps
Implemented (PH-1.2, hardened in PH-1.5):
- `OrbitIdentityPort.resolve(headers) → Actor | null` with `CustomerActor { id, source }` and `StaffActor { id, role, displayName, source }`; every actor carries `source: 'simulated'`.
- `SimulatedOrbitIdentity`: reads `x-simulated-customer-id` or `x-simulated-staff-id` (+ `-role`, `-name`); refuses ambiguous (both), malformed ids and unknown roles.
- Guards `CustomerGuard`, `StaffGuard`, `AnyActorGuard`, decorator `@CurrentActor()`; `GET /api/identity/me` echoes the actor.
- Roles in use (PH-3.3): `StaffActor.role` decides reassignment authority (`supervisor` / `admin` may reassign any case — DEC-0012); every other staff action is role-neutral until PH-7 (a non-owner may set status, resolve, close or consult on a colleague's case; attribution is kept — BL-016 records the open decision).
- Staff directory (Cycle Audit 1, DEC-0017): `StaffDirectory.isKnownStaff(id)` is the second port of the boundary; `SimulatedStaffDirectory` answers from `SIMULATED_STAFF_DIRECTORY` in `packages/shared` (the same list the web pickers use). Transfers to unknown ids are refused (400 `unknown_agent`). A real Orbit directory adapter replaces it without touching callers.
- Provider selection `resolveIdentityProviderName(env)`: only `simulated` exists; refuses to start with `NODE_ENV=production` (any casing) unless `SUPPORT_ALLOW_SIMULATED_IDENTITY=true` (DEC-0008). Simulated display names are unbounded — the real adapter must bound and sanitize them.
- Web: simulated customer/staff pickers persisted in `localStorage`, always labeled **Simulação**; `/api/health` reports `identity: simulated`.
- Records boundary (PH-4.1, DEC-0019): `OrbitRecordsPort.customerSummary(userId) → OrbitLookup<OrbitCustomerSummary>` — `available` with already-masked data or `unavailable` with a reason (`not_integrated`, `not_found`, `unavailable`, `timeout`), always with `source` and `fetchedAt`. `SimulatedOrbitRecords`: fixtures for the three simulated customers, `not_found` for others, outage mode `SUPPORT_SIMULATED_ORBIT=unavailable`. Served by `GET /api/staff/cases/:id/orbit`; rendered by `OrbitCustomerSection` in the staff context column with loading / available / unavailable + retry, labeled Simulação. Masking helpers `maskEmail` / `maskPhone` live in `packages/shared/src/orbit.ts`.
- Contact for notifications (PH-6.2): `OrbitRecordsPort.contactEmail(userId)` returns the raw verified address to the e-mail notifier only; no UI surface ever receives it (§10.2).
- Records (PH-4.2, DEC-0020): `listRecords(userId)` and `getRecord(userId, kind, reference)` for `operation`, `pix_deposit`, `withdrawal` — a generic `OrbitRecord` (title, status, occurredAt, amount/currency, masked `facts[]`); ownership is part of the lookup (another customer's record → `not_found`). `GET /api/support/records` lists the customer's own records with the active case per record; a case created with `record` keeps a snapshot (`CaseRecord`) and the staff Orbit context adds the record's current state.
Not implemented: P2P, balances, bonuses, referral and product-error subjects — listed in the staff Orbit section as "Ainda não integrado" with the `not_integrated` reason (PH-4.3); role-gated unmasking (PH-7); the real Orbit session/records adapters (BL-001). PH-4 approved 2026-09-14 (`docs/evidence/PH-4-phase-approval.md`).

## Dependencies and consumers
Depends on: nothing inside the repo (it is the outer boundary). Used by: every guarded controller (FEAT-CASE), FEAT-CHAT and FEAT-STAFF (headers), future FEAT-NOTIFY (contact resolution) and FEAT-ACCESS (recovery contact). Shared contract owner: `packages/shared/src/identity.ts` (`STAFF_ROLES`, `IDENTITY_SOURCES`, `SIMULATED_IDENTITY_HEADERS`, `SIMULATED_STAFF_DIRECTORY`).

## Where to work
- Port and actors: `apps/api/src/identity/identity.types.ts`; provider: `apps/api/src/identity/simulated-orbit-identity.ts`; selection/module: `apps/api/src/identity/identity.module.ts`; guards: `apps/api/src/identity/guards.ts`.
- Records: port `apps/api/src/identity/orbit-records.ts`; simulated adapter `simulated-orbit-records.ts` (fixtures and masking); endpoint in `apps/api/src/cases/staff-cases.controller.ts`; UI `apps/web/src/features/staff/OrbitCustomerSection.tsx`; copy under `staff.orbit` in the dictionary.
- Tests: `apps/api/src/identity/identity.spec.ts`, `orbit-records.spec.ts`, `apps/api/test/app.e2e-spec.ts` (401/403 negatives, `/identity/me`, `/orbit` masked and unavailable states), `apps/web/src/features/staff/StaffWorkspace.test.tsx`, `packages/shared/src/orbit.test.ts`.
- A real adapter goes next to the simulated one, selected by `SUPPORT_IDENTITY_PROVIDER`; callers do not change.

## Important failure and permission behavior
No actor → 401 `identity_required`; wrong kind for the surface → 403 (`customer_only` / `staff_only`). The simulated provider must never be reachable from a real customer: production refuses it by default. A records lookup never throws for missing data: it answers `unavailable` with a reason, and the UI shows that state, never zero or an assumed value (RULE-SUP-07); raw contact details never cross the boundary (§10.2). Simulated data never demonstrates a connected capability (context §11); demos must state which one they use.

## Decisions and assumptions
ADR-0002 (dedicated project with explicit boundary), DEC-0003 (Owner: no Orbit system exists), DEC-0008 (provider selection and production refusal). Assumption: Orbit will expose a session verification and read-only record APIs; if Orbit instead hosts this code, the port stays and the adapter changes (ADR-0002 revisit trigger).

## Verification and change checklist
Any change here → `npm test -w api` and `npm run test:e2e -w api` (negatives included); header names → rebuild shared and run `npm test -w web`. Last scoped evidence: `docs/evidence/PH-4-phase-approval.md`, `docs/evidence/PH-4.3-verification.md`.
