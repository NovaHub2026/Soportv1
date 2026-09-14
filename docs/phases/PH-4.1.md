# PH-4.1 — Orbit records boundary and customer summary
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-4.md`
Feature context: `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`

## Objective, prerequisites and scope
Staff opening a case see who the customer is in Orbit terms — username, account status, language, country, registration date, masked e-mail and phone, summarized verification and real/demo environment — or an explicit "unavailable" state with the reason, never an assumed value (context §6.1, §6.2, RULE-SUP-07). The information crosses one boundary, `OrbitRecordsPort`, whose only implementation is a labeled simulation (DEC-0003). Prerequisite: Cycle Audit 1 closed. Out of scope: records and cards (PH-4.2), customer-facing summary, role-gated unmasking (PH-7).

## Affected boundaries and implementation approach
- Contracts (`packages/shared/src/orbit.ts`): `OrbitCustomerSummary` (already masked), `OrbitLookup<T>` = `{ state: 'available', data }` | `{ state: 'unavailable', reason }` with `source` and `fetchedAt`; vocabularies for account status, verification status, environment and unavailability reasons; `maskEmail` / `maskPhone` helpers with tests.
- Boundary (`apps/api/src/identity/orbit-records.ts`): `OrbitRecordsPort.customerSummary(userId)`; token `ORBIT_RECORDS`; `SimulatedOrbitRecords` with fixtures for the three simulated customers, `not_found` for anyone else, and `SUPPORT_SIMULATED_ORBIT=unavailable` to simulate an outage. Raw contact details never leave the adapter: masking happens inside it.
- API: `GET /api/staff/cases/:id/orbit` → `{ customer: OrbitLookup<OrbitCustomerSummary> }` (StaffGuard; 404 for unknown cases). Separate from the case detail so an adapter failure never slows or breaks the conversation. `/api/health` reports `orbitRecords: 'simulated'`.
- Web staff: `OrbitCustomerSection` in the context column — loading, available (facts with masked contact and pt-BR labels), unavailable (reason + "Tentar novamente"); simulation badge; the old static note now only says that records arrive in PH-4.2.

## Required behavior, failures and acceptance evidence
- Customers cannot call the endpoint (403); an unknown case answers 404; a case whose customer is unknown to the adapter answers 200 with `state: 'unavailable', reason: 'not_found'`.
- The JSON never contains a raw e-mail or phone (e2e negative asserts on the serialized body).
- Outage mode answers 200 with `state: 'unavailable', reason: 'unavailable'`; the UI shows the reason and a retry; the conversation stays usable.
Acceptance evidence: `../evidence/PH-4.1-verification.md`.

## Work performed and important decisions
- `packages/shared/src/orbit.ts`: vocabularies, `OrbitCustomerSummary`, `OrbitLookup<T>`, `OrbitCaseContext`, `maskEmail` / `maskPhone`.
- `apps/api/src/identity/orbit-records.ts` (port + token), `simulated-orbit-records.ts` (fixtures for cust-alice / cust-bruno / cust-carla, `not_found` otherwise, `SUPPORT_SIMULATED_ORBIT=unavailable` outage mode; masking inside the adapter), `IdentityModule` provides `ORBIT_RECORDS` (`SUPPORT_ORBIT_RECORDS=simulated` is the only value).
- `GET /api/staff/cases/:id/orbit` in `StaffCasesController`; `/api/health` reports `orbitRecords`.
- Web: `OrbitCustomerSection` (loading / available / unavailable + retry, keyed by case), `staffApi.getOrbitContext`, pt-BR labels under `staff.orbit`; the static "not built" note is replaced by the section and a one-line "records not integrated yet" note.
- DEC-0019: lookups are a discriminated `available | unavailable(reason)` shape with `source` and `fetchedAt`; masking happens inside the adapter so raw contact details never cross the boundary; the context is a separate read from the case detail.

## Verification, limitations and context updates
Evidence: `../evidence/PH-4.1-verification.md`. Limitations: fixtures approximate §6.1; no real Orbit; masking policy is a working default (context §10.2) until PH-7 defines roles.
Context updated: `PH-4.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../runbooks/VERIFICATION.md`, `../decisions/DECISION_LOG.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
