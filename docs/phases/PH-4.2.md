# PH-4.2 — Record cards and contextual entry
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-4.md`
Feature context: `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`

## Objective, prerequisites and scope
A customer asks for help about a specific record — a withdrawal, a Pix deposit, an operation — from the host with "Preciso de ajuda", without typing ids (`PROJECT_CONTEXT.md` §4.2, §14 item 1). The request shows a recognizable card of the record, which the customer can remove before sending; if that record already has an active case the panel offers to continue it. The case keeps a snapshot of the record as it was when the case was opened (§6.2), staff see the card with its masked facts plus the record's current state from Orbit, and a record the boundary cannot find still opens the case as an investigation with the reason on the card (§14 item 7, RULE-SUP-07). Prerequisite: PH-4.1. Out of scope: balances/bonus/referral subjects (visible as not integrated), role-gated unmasking (PH-7), search by record (PH-5).

## Affected boundaries and implementation approach
- Contracts: `OrbitRecord` (kind, reference, title, status, occurredAt, amount/currency, masked `facts[]` — a generic shape so the real adapter maps any §6.1 subject), `OrbitRecordListItem` (+ `activeCaseId`/`activeCaseReference`), `CaseRecord` (snapshot + `capturedAt` + `lookupReason`), `createCaseSchema.record`, `CaseSummary.recordKind/recordReference`, `OrbitCaseContext.record`.
- Boundary: `OrbitRecordsPort.listRecords(userId)` and `getRecord(userId, kind, reference)` — ownership is part of the lookup (another customer's record is `not_found`, RULE-SUP-01); simulated fixtures for the three customers with masked destinations and provider references.
- Schema migration `0008`: `support_cases.record_kind / record_reference / record_captured_at / record_snapshot / record_lookup_reason` (+ index by customer and record).
- API: `GET /api/support/records` (own records with the active case per record); `POST /api/support/cases` accepts `record`, captures the snapshot before the transaction and records `record` in the `case_created` event; details carry `record`; `GET /api/staff/cases/:id/orbit` adds the record's current lookup.
- Web: records section in the simulated host with "Preciso de ajuda" per record → `SupportPanel` entry → `NewRequestForm` with the `RecordCard`, topic preselected from the kind, "Remover registro", and the continue-existing-case notice (send disabled until "É outro problema"); the card in the customer conversation and in the staff header (detailed facts); "Estado atual no Orbit" in the staff context section.

## Required behavior, failures and acceptance evidence
- Staff cannot list customer records (403); a customer unknown to the adapter gets `unavailable/not_found`; the list never contains raw contact details.
- Creating with an unknown `kind` → 400; with another customer's record → 201 with `snapshot: null, lookupReason: 'not_found'` and no data of the other customer in the response.
- After creating from a record, the list flags that record with the new case; a resolved case is no longer active for it.
- Staff detail carries the snapshot; the Orbit context carries the current state (which can differ from the snapshot).
Acceptance evidence: `../evidence/PH-4.2-verification.md`.

## Work performed and important decisions
DEC-0020: one record per case, denormalized on `support_cases` (kind, reference, snapshot, capture time, lookup reason) — enough for §4.2/§6.2 without a join, and the customer projection needs no new rule (the snapshot is already masked by the adapter). The record shape is a generic fact list, not a per-subject schema, so the boundary stays narrow (ADR-0002). The "continue the active case" suggestion is a UI decision informed by `activeCaseId`; the API never refuses a second case on the same record (§4.2: the customer may say it is a different issue).

## Verification, limitations and context updates
Evidence: `../evidence/PH-4.2-verification.md`. Limitations: fixtures only; the current-state lookup is read once when the case view loads (retry available in the section); no customer-side current state (the card is the snapshot, by design §6.2).
Context updated: `PH-4.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, the four feature contexts, `../runbooks/VERIFICATION.md`, `../decisions/DECISION_LOG.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
