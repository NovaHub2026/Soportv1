# PH-5 — Phase approval evidence
Type: VERIFICATION EVIDENCE
Work item: PH-5 — Staff workspace completeness and supervision (phase-level acceptance, `GOVERNANCE.md` §6.3)
Recorded on: 2026-09-14
Revision: `c3fc6a8` plus the PH-5.4 working tree (the PH-5.4 commit on `main` is the phase candidate).
Environment: as in `PH-4.1-verification.md`.

## Phase scenarios (from `docs/phases/PH-5.md`) and evidence
| # | Scenario | Evidence | Category |
|---|---|---|---|
| a | Agent switches to "Aguardando cliente" / "Aguardando equipe" and sees since when each case waits | Service test (views, ordering), web test ("Sem resposta há 3 h"), smoke `history-views` (PH-5.1) | EXECUTED + OBSERVED |
| b | A resolved case is found under "Resolvidos" and a closed one under "Encerrados" | Service + e2e tests; smoke `history-views` (PH-5.1) | EXECUTED + OBSERVED |
| c | A supervisor sees unassigned demand and the oldest unanswered message, and reassigns from the overview | Service test (overview, overdue), web test (reassign posts `/assign`), smoke `supervision` (PH-5.4) | EXECUTED + OBSERVED |
| d | Search by `SUP-000003`, `cust-alice`, `WD-48213` finds the case | Service + e2e tests (reference with/without prefix, customer, subject, record), smoke `search` (PH-5.2) | EXECUTED + OBSERVED |
| e | An agent inserts a saved reply, edits it and sends | Web test (insert without sending), e2e (create/edit/remove with roles), smoke `saved-reply` (PH-5.3) | EXECUTED + OBSERVED |
| f | A supervisor sets the schedule and the customer panel shows the configured hours honestly | Shared availability tests, e2e (working default → configured), smoke `availability` and `availability-configured` (PH-5.4) | EXECUTED + OBSERVED |
| g | Metrics show first response and resolution for the period, labeled computed with no targets | Service test (`targets: null`, sample sizes), web test, smoke `supervision` (PH-5.4) | EXECUTED + OBSERVED |

## Rules
RULE-SUP-02: every state has a view; the overview surfaces unassigned and overdue cases; reassignment from the overview uses the transfer endpoint (history kept, directory-validated). RULE-SUP-08: the customer availability line is computed from the configured schedule and says whether it is still a working default; metrics carry `targets: null` and the UI says no targets exist (BL-002). RULE-SUP-09: saved replies and settings are attributed on every change. §5.4: supervision surfaces are gated to supervisors/admins (simulated role until PH-7) and agents get 403.

## Delivery states (§6.3)
Implemented and locally verified: yes. Integrated: `main` (PH-5.4 commit). CI verified: recorded in `PH-5.4-verification.md`. Released: no.

## Uses simulation
Simulated identity and simulated Orbit records (DEC-0003); staff roles are the simulated labels (PH-7). No demonstration proves a connected Orbit capability (context §11).

## Findings during the phase
FND-0028 (process): two commits created after a failed gate (`3217c53`, `6d11ee8`), corrected by their successors; BL-020 (gate-then-commit script adopted). Harness: seven tabs overflowed the queue column (fixed in PH-5.1), locator ambiguity and debounce timing (fixed in PH-5.2/5.3). No open product findings. Backlog: BL-011 done; BL-013, BL-014 remain (composer idempotency for notes, `StaffCaseView` refactor).

## Approval
PH-5 `APPROVED` on 2026-09-14 by the Agent (evidence-based, not a human review). Ledger: cycle 2, 2/3 — one more first-time phase approval triggers Cycle Audit 2 (§6.4).
