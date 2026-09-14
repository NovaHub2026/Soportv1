# PH-4 — Phase approval evidence
Type: VERIFICATION EVIDENCE
Work item: PH-4 — Orbit context integration (phase-level acceptance, `GOVERNANCE.md` §6.3)
Recorded on: 2026-09-14
Revision: `4c06c5c` plus the PH-4.3 working tree (the PH-4.3 commit on `main` is the phase candidate).
Environment: as in `PH-4.1-verification.md` (Windows 11 native, Node v24.19.0, npm 11.17.0, Playwright Chromium).

## Phase scenarios (from `docs/phases/PH-4.md`) and evidence
| # | Scenario | Evidence | Category |
|---|---|---|---|
| a | Staff open a case and see the customer's summary with masked e-mail/phone, verification status and environment, labeled simulation | Smoke `orbit-summary` (`09-staff-case-reply.png`); adapter unit + e2e negatives (raw contact absent); web tests (PH-4.1) | OBSERVED + EXECUTED |
| b | The adapter is unavailable → the summary section says so with a retry; the conversation stays usable | Smoke `orbit-outage-staff`, `orbit-outage-customer` (`21-staff-orbit-outage.png`, `22-customer-orbit-outage.png`); e2e outage mode; web unavailable-state test (PH-4.1, PH-4.3) | OBSERVED + EXECUTED |
| c | "Preciso de ajuda" on a withdrawal → the case shows the withdrawal card; staff see the card with the snapshot and the current status | Smoke `record-entry`, `record-staff` (`18-customer-record-case.png`, `19-staff-record-case.png`); service + e2e + web tests (PH-4.2) | OBSERVED + EXECUTED |
| d | The customer changes the attached record before sending | Web test "the card can be removed" (`NewRequestForm.test.tsx`) — removal yields a general question; a different record is chosen from the host list (smoke `record-entry` starts from the list) | EXECUTED |
| e | The same record already has an active case → the customer is offered to continue it | Smoke `record-continue`; service test `activeCasesByRecord`; e2e `activeCaseId`; web test (PH-4.2) | OBSERVED + EXECUTED |
| f | A record the adapter cannot find is shown as not found and the case proceeds as an investigation | Smoke `record-not-found`, `record-not-found-staff` (`20-customer-record-not-found.png`); service test (`lookupReason: not_found`, no foreign data); e2e; web tests (PH-4.2, PH-4.3) | OBSERVED + EXECUTED |

## Rules
RULE-SUP-01: records are looked up inside the adapter for the calling customer only; another customer's reference answers `not_found` (service + e2e negatives, no foreign data in responses). RULE-SUP-05: `OrbitRecordsPort` is read-only; no endpoint writes to Orbit. RULE-SUP-07: every lookup is `available` or `unavailable` with a reason on every surface (summary, records list, record card, current state, not-integrated subjects); nothing is rendered as zero or as an assumed state. §10.2 masking: see below.

## Masking
Contacts (`maskEmail`, `maskPhone`) and record destinations/provider references are masked inside `SimulatedOrbitRecords` before anything crosses the boundary; `RecordCard` and `OrbitCustomerSection` render adapter output only; the customer projection (DEC-0015) removes staff-only case fields; `case_created` stores kind, reference and whether a snapshot was captured, never record data. Role-gated unmasking is deferred to PH-7 (BL-016).

## Delivery states (§6.3)
Implemented and locally verified: yes. Integrated: `main` (PH-4.3 commit). CI verified: recorded in `PH-4.3-verification.md`. Released: no.

## Uses simulation
Every demonstration uses the simulated identity provider and the simulated records adapter (DEC-0003). None of it demonstrates a connected Orbit capability (context §11, §14 item 10); the real adapters replace `SimulatedOrbitIdentity` / `SimulatedOrbitRecords` when Orbit exists (BL-001).

## Findings during the phase
None open. Harness: the smoke restarts the API in outage mode (`stopChild` / `waitForExit`).

## Approval
PH-4 `APPROVED` on 2026-09-14 by the Agent (evidence-based, not a human review). Ledger: cycle 2, 1/3.
