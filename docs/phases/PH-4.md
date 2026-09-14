# PH-4 — Orbit context integration
Type: PHASE CONTEXT
Status: ACTIVE
Objective / Feature IDs: OBJ-SUP-02, OBJ-SUP-04; FEAT-ORBIT, FEAT-STAFF, FEAT-CHAT, FEAT-CASE
Cycle: 2 (see `ROADMAP.md`; cycle 1 closed with Cycle Audit 1 — `../audits/CYCLE-1.md`)

## Outcome and why now
Staff identify the right customer and see the Orbit context an issue needs without asking for information Orbit already holds, and customers can ask for help from a specific record without typing ids (`PROJECT_CONTEXT.md` §6, §4.2, §14 items 1 and 7). Every piece of Orbit information is shown as verified, pending or unavailable — never as an assumed value (RULE-SUP-07) — and only according to role and case need, masked by default (RULE-SUP-01, §10.2). Orbit does not exist yet (DEC-0003): this phase builds the records side of the boundary (ADR-0002) with a labeled simulated adapter, so the real adapter later replaces one module and nothing else. Why now: PH-1..3 delivered the case and collaboration machinery; Cycle Audit 1 is closed; the staff context column still says "Orbit data unavailable" for everything.

## Scope, non-goals and dependencies
In scope: an `OrbitRecordsPort` next to `OrbitIdentityPort` with a simulated adapter (fixtures per simulated customer, configurable outage); the standard customer summary (username, account status, language, country, registration, masked contact, summarized verification, real/demo environment) in the staff context column; records relevant to a case (operation, Pix deposit, withdrawal — the §6.1 subjects that PH-1's categories already route) as cards attached to a case with the snapshot captured at link time (§6.2: current status vs. what occurred); contextual entry "Preciso de ajuda" from a simulated record in the Orbit shell, with the card visible and correctable by the customer and a suggestion to continue an existing active case on the same record; unavailable/not-found states for every lookup; masking of destinations and contact details; simulation labels everywhere.
Non-goals: the real Orbit adapter (BL-001 — no Orbit system exists); balances/movements, bonus, referral and product-error subjects beyond a visible "not integrated" state; any write to Orbit (RULE-SUP-05, §6.3); search/filters (PH-5); notifications (PH-6); recovery route (PH-7).
Dependencies: PH-1 (approved), ADR-0002, DEC-0003; DEC-0015 (customer projection) governs what customers may see of a record.

## Product rules and acceptance scenarios
- RULE-SUP-01: a customer only ever sees their own records; a record id in a request grants nothing (ownership checked through the adapter and the case).
- RULE-SUP-05: the adapter is read-only; no endpoint changes money, results or permissions.
- RULE-SUP-07: each lookup answers `available` or `unavailable` with a reason (`not_integrated`, `not_found`, `unavailable`, `timeout`); the UI shows the state, never zero, "paid" or an invented value; a snapshot says when it was captured.
- §10.2: contact and destination details masked by default; deeper detail is role-gated later (PH-7).
Scenarios (context §14 items 1, 7): (a) staff open a case and see the customer's summary with masked e-mail/phone, verification status and environment, labeled simulation; (b) the adapter is unavailable → the summary section says so, with a retry, and the conversation stays usable; (c) a customer taps "Preciso de ajuda" on a withdrawal in the shell → the new case shows the withdrawal card; staff see the same card with the snapshot and the current status; (d) the customer changes the attached record before sending; (e) the same withdrawal already has an active case → the customer is offered to continue it; (f) a record the adapter cannot find is shown as "não encontrado" and the case proceeds as an investigation, not with an assumed answer.

## Important uncertainties and decision references
- Record shapes are simulated approximations of §6.1; the real Orbit schema will differ — the boundary keeps callers stable (ADR-0002 revisit trigger).
- Which staff roles may see unmasked details is a PH-7 decision (BL-016); PH-4 masks for everyone.
- Snapshot retention and refresh cadence are working defaults to record in the decision log.

## Planned subphases, adjusted as evidence arrives
| ID | Block | Status |
|---|---|---|
| PH-4.1 | Orbit records boundary and customer summary: `OrbitRecordsPort`, simulated adapter with masking and outage mode, `GET /api/staff/cases/:id/orbit`, staff context column section with available/unavailable states — `PH-4.1.md`, approved 2026-09-14 | APPROVED |
| PH-4.2 | Record cards and contextual entry: simulated records per customer, `case_records` snapshots, "Preciso de ajuda" from the shell, card in both conversations, correction and continue-existing-case suggestion | PLANNED |
| PH-4.3 | Unavailable and not-found flows end to end, masking review, browser smoke for scenarios (a)–(f), phase closure | PLANNED |

## Verification and operational readiness
Per subphase: unit tests on the adapter (fixtures, not-found, outage), e2e on the endpoints (403 for customers, 404 for unknown cases, masked payloads — raw contact never in JSON), web tests on the states; browser smoke extended with the summary and, in PH-4.2, the contextual entry. `npm run verify` before each commit; `npm run verify:full` and the smoke on the phase candidate. Operational note: the simulated adapter is selected by `SUPPORT_ORBIT_RECORDS=simulated` (only value) and its outage mode by `SUPPORT_SIMULATED_ORBIT=unavailable`.

## Completion evidence, findings and context updated
Pending — filled at phase approval. Everything runs on simulated identity and simulated records (DEC-0003); no demonstration in this phase proves a connected Orbit capability (context §11).
