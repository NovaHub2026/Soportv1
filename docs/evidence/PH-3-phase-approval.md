# PH-3 — Phase approval evidence
Type: VERIFICATION EVIDENCE
Work item: PH-3 — Case lifecycle and staff collaboration (phase-level acceptance, `GOVERNANCE.md` §6.3)
Recorded on: 2026-09-13 (final runs 2026-09-14 02:06–02:20 UTC)
Revision: `426678a` plus the PH-3.5 working tree (the PH-3.5 commit on `main` is the phase candidate).
Environment: as in `PH-2.3-verification.md`.

## Phase scenarios (from `docs/phases/PH-3.md`) and evidence
| # | Scenario | Evidence | Category |
|---|---|---|---|
| a | Agent asks for information → "Aguardando sua resposta" → customer replies → back to "Em atendimento" | Smoke `waiting-customer`; service + e2e tests (PH-3.1) | OBSERVED + EXECUTED |
| b | Agent consults Finance → customer sees "Em análise", staff see the pending question; answer → back to in progress, owner alerted | Smoke `consultation`, `consultation-answered`; service tests incl. two open consultations; e2e text-leak negatives (PH-3.2) | OBSERVED + EXECUTED |
| c | Resolve with reason + explanation → customer sees "Resolvido" and the explanation; "Ainda preciso de ajuda" reactivates the same case | Smoke `resolved`, `reopened` (`13-customer-resolved.png`); service/e2e (PH-3.1) | OBSERVED + EXECUTED |
| d | Transfer keeps history; the queue shows the new owner; release and retake | Smoke `transfer-priority`, `release-retake` (`15-staff-transferred.png`); service tests with consultations preserved; e2e role negatives (PH-3.3) | OBSERVED + EXECUTED |
| e | Resolved > 7 days closes automatically; "Preciso de mais ajuda" opens a linked follow-up with the previous context | Service test `closeExpired` (window, idempotence, system actor); smoke `closed`, `follow-up`, `follow-up-staff` (`16-customer-follow-up.png`) via explicit staff close (PH-3.4) | EXECUTED + OBSERVED |
| f | Cases linked to one incident receive coordinated internal notes; resolving the incident does not resolve the cases | Smoke `incident` (`17-staff-incident.png`); service test with two linked cases and one unrelated; e2e (PH-3.5) | OBSERVED + EXECUTED |

## Rules
RULE-SUP-02: unowned actions assign the actor; transfer/release preserve everything; supervisor reassignment (PH-3.3). RULE-SUP-04: notes, consultation texts and incident broadcasts absent from customer detail/streams/counts (unit + e2e negatives, smoke leak checks). RULE-SUP-05: no code path changes money or account state; closing/resolving touch only case rows. RULE-SUP-06: reactivation from resolved, follow-up from closed. RULE-SUP-09: every transition, transfer, consultation, resolution, closure and incident link is an attributable `case_events` row rendered in the staff history.

## Delivery states (§6.3)
Implemented and locally verified: yes. Integrated: `main` as `11f178a`. CI verified: run 34798515452 success (recorded in `PH-3.5-verification.md` during Cycle Audit 1). Released: no.

## Uses simulation
All demonstrations use simulated identity, a fixed simulated staff list and no Orbit records (DEC-0003).

## Findings during the phase
None open at approval. Harness-only locator ambiguities fixed in `scripts/ui-smoke.mjs`.

## Limitations stated after Cycle Audit 1 (FND-0023)
Scenario (b) "owner alerted" is only the staff unread badge — no event or notification until PH-6. §14.9 is demonstrated for unassigned cases only: there is no staff view of waiting, resolved or closed cases and no overdue signal (PH-5, BL-011). Cycle Audit 1 also found and fixed material defects in this phase's scope (customer contract leaking incident fields, unvalidated transfer targets, resolution with open consultations, ownership and closure races, idempotency scope) — see `../audits/CYCLE-1.md`; the approval stands because the phase's user outcomes were delivered, and the corrections are in the remediation commit with regression tests.

## Approval
PH-3 `APPROVED` on 2026-09-13 by the Agent (evidence-based, not a human review). Ledger: cycle 1, **3/3 — the Cycle Audit is due now** (`docs/audits/CYCLE-1.md`, opened with this approval; ordinary feature development pauses until it closes — §6.4).
