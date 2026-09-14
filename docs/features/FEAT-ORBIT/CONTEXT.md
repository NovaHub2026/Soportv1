# Orbit context integration
Type: FEATURE CONTEXT
Feature ID: FEAT-ORBIT
Lifecycle: PARTIAL (identity boundary only; records pending)
Freshness: CURRENT
Verified against: `b5d3890` plus the PH-1.5 change
Verified on: 2026-09-13
Scope: `apps/api/src/identity/`, `packages/shared/src/identity.ts`, `apps/web/src/lib/simulated-session.ts`, identity headers in `apps/web/src/lib/api.ts` and `apps/web/src/lib/staff-api.ts`

## User outcome and applicable product rules
Staff identify the right customer and inspect the records relevant to an issue without asking for information Orbit already holds; customers never type their own ids (`PROJECT_CONTEXT.md` §6, OBJ-SUP-02). Orbit does not exist yet (DEC-0003): today this feature is the **boundary** through which identity — and later records — will arrive, plus its simulated implementation.
Rules: RULE-SUP-01 (knowing an id grants nothing), RULE-SUP-05 (support never gains financial/account authority through this boundary), RULE-SUP-07 (unavailable data is shown as unavailable).

## Current behavior and known gaps
Implemented (PH-1.2, hardened in PH-1.5):
- `OrbitIdentityPort.resolve(headers) → Actor | null` with `CustomerActor { id, source }` and `StaffActor { id, role, displayName, source }`; every actor carries `source: 'simulated'`.
- `SimulatedOrbitIdentity`: reads `x-simulated-customer-id` or `x-simulated-staff-id` (+ `-role`, `-name`); refuses ambiguous (both), malformed ids and unknown roles.
- Guards `CustomerGuard`, `StaffGuard`, `AnyActorGuard`, decorator `@CurrentActor()`; `GET /api/identity/me` echoes the actor.
- Provider selection `resolveIdentityProviderName(env)`: only `simulated` exists; refuses to start with `NODE_ENV=production` unless `SUPPORT_ALLOW_SIMULATED_IDENTITY=true` (DEC-0008).
- Web: simulated customer/staff pickers persisted in `localStorage`, always labeled **Simulação**; `/api/health` reports `identity: simulated`.
Not implemented (PH-4): customer summary (username, status, language, country, registration, masked contact, verification), record lookups (operations, P2P orders/rounds, Pix deposits, withdrawals, balances, bonuses, verification, referral), contextual entry cards, masking, "unavailable" states per record, and the real Orbit session adapter.

## Dependencies and consumers
Depends on: nothing inside the repo (it is the outer boundary). Used by: every guarded controller (FEAT-CASE), FEAT-CHAT and FEAT-STAFF (headers), future FEAT-NOTIFY (contact resolution) and FEAT-ACCESS (recovery contact). Shared contract owner: `packages/shared/src/identity.ts` (`STAFF_ROLES`, `IDENTITY_SOURCES`, `SIMULATED_IDENTITY_HEADERS`).

## Where to work
- Port and actors: `apps/api/src/identity/identity.types.ts`; provider: `apps/api/src/identity/simulated-orbit-identity.ts`; selection/module: `apps/api/src/identity/identity.module.ts`; guards: `apps/api/src/identity/guards.ts`.
- Tests: `apps/api/src/identity/identity.spec.ts`, `apps/api/test/app.e2e-spec.ts` (401/403 negatives, `/identity/me`).
- A real adapter goes next to the simulated one, selected by `SUPPORT_IDENTITY_PROVIDER`; callers do not change.

## Important failure and permission behavior
No actor → 401 `identity_required`; wrong kind for the surface → 403 (`customer_only` / `staff_only`). The simulated provider must never be reachable from a real customer: production refuses it by default. Simulated data never demonstrates a connected capability (context §11); demos must state which one they use.

## Decisions and assumptions
ADR-0002 (dedicated project with explicit boundary), DEC-0003 (Owner: no Orbit system exists), DEC-0008 (provider selection and production refusal). Assumption: Orbit will expose a session verification and read-only record APIs; if Orbit instead hosts this code, the port stays and the adapter changes (ADR-0002 revisit trigger).

## Verification and change checklist
Any change here → `npm test -w api` and `npm run test:e2e -w api` (negatives included); header names → rebuild shared and run `npm test -w web`. Last scoped evidence: `docs/evidence/PH-1.5-verification.md`.
