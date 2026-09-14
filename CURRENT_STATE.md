# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-4.md`; base checkpoint: `bb92d9e` on `main` (PH-4.1) plus this CI-verdict record

| Field | Value |
|---|---|
| Active objective / feature | PH-4 Orbit context integration (OBJ-SUP-02): staff see the customer's Orbit summary and record context, masked and honestly available/unavailable, through a labeled simulated adapter behind the ADR-0002 boundary. Cycle Audit 1 CLOSED 2026-09-14 (`docs/audits/CYCLE-1.md`). |
| Active phase / subphase | PH-4 `ACTIVE` (`docs/phases/PH-4.md`, Orbit context integration). PH-4.1 `APPROVED` 2026-09-14 (`docs/phases/PH-4.1.md`); PH-4.2 `PLANNED` (record cards and contextual entry), PH-4.3 `PLANNED`. PH-1, PH-2, PH-3 `APPROVED` 2026-09-13. |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 0/3, open cycle, no debt. |
| Blocking decisions / dependencies | None. PH-4 depends on ADR-0002 (boundary) and BL-001 (resolved: everything simulated, DEC-0003). |
| Integration / CI / release | Candidate: `bb92d9e` on `main` (PH-4.1). Local: `npm run verify` exit 0, `npm run build` exit 0, browser smoke 33/33; CI run 34811611890 success — `docs/evidence/PH-4.1-verification.md`. Release: none, not authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0; earlier sessions ran on WSL2. The repo-local git author (DEC-0002) must be re-set on every fresh clone — see `docs/runbooks/VERIFICATION.md` "Setup". |
| Context route | `CONTEXT_INDEX.md` → four live feature contexts (all re-verified against the remediation commit); audit record `docs/audits/CYCLE-1.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Plan and start PH-4.2 (record cards and contextual entry): create `docs/phases/PH-4.2.md` (to be created) — simulated records per customer through `OrbitRecordsPort` (operations, Pix deposits, withdrawals with masked destinations), `case_records` snapshots captured at link time, "Preciso de ajuda" from a record in the Orbit shell, the card in both conversations, correction before sending, and the suggestion to continue an active case on the same record (`PROJECT_CONTEXT.md` §4.2, §6.1–6.2, §14 items 1 and 7).
Why now: PH-4.1 delivered the boundary and the customer summary; records are the next block of the active phase.
Preconditions: CI green on HEAD (`bb92d9e` is: run 34811611890); tree clean; `npm run verify` passes.
Evidence/read first: `docs/phases/PH-4.md` (scenarios c–f); `docs/features/FEAT-ORBIT/CONTEXT.md` and `docs/features/FEAT-CASE/CONTEXT.md` (DEC-0015 customer projection, DEC-0017 lock rule for any new case write); `PROJECT_CONTEXT.md` §4.2, §6.1–6.2.
If preconditions fail: CI red → diagnose before any PH-4 work (§9.2). Unknown local changes → attribute and preserve (§4.3).
