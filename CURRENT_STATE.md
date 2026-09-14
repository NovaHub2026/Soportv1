# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-4.md`; base checkpoint: the PH-4.2 commit on `main` (child of `0d8dcc9`)

| Field | Value |
|---|---|
| Active objective / feature | PH-4 Orbit context integration (OBJ-SUP-02): staff see the customer's Orbit summary and record context, masked and honestly available/unavailable, through a labeled simulated adapter behind the ADR-0002 boundary. Cycle Audit 1 CLOSED 2026-09-14 (`docs/audits/CYCLE-1.md`). |
| Active phase / subphase | PH-4 `ACTIVE` (`docs/phases/PH-4.md`, Orbit context integration). PH-4.1 `APPROVED` 2026-09-14 (`docs/phases/PH-4.1.md`); PH-4.2 `APPROVED` 2026-09-14 (`docs/phases/PH-4.2.md`); PH-4.3 `PLANNED` (unavailable and not-found flows end to end, masking review, phase closure). PH-1, PH-2, PH-3 `APPROVED` 2026-09-13. |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 0/3, open cycle, no debt. |
| Blocking decisions / dependencies | None. PH-4 depends on ADR-0002 (boundary) and BL-001 (resolved: everything simulated, DEC-0003). |
| Integration / CI / release | Candidate: the PH-4.2 commit on `main`. Local: `npm run verify` exit 0, `npm run build` exit 0, browser smoke 36/36 — `docs/evidence/PH-4.2-verification.md` (CI verdict recorded there when known). Previous: `bb92d9e` CI green (`docs/evidence/PH-4.1-verification.md`). Release: none, not authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0; earlier sessions ran on WSL2. The repo-local git author (DEC-0002) must be re-set on every fresh clone — see `docs/runbooks/VERIFICATION.md` "Setup". |
| Context route | `CONTEXT_INDEX.md` → four live feature contexts (all re-verified against the remediation commit); audit record `docs/audits/CYCLE-1.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Plan and run PH-4.3 (`docs/phases/PH-4.3.md`, to be created): exercise the unavailable and not-found flows end to end in the browser smoke (outage mode `SUPPORT_SIMULATED_ORBIT=unavailable` for the summary and the records list; a not-found record card), review masking on every surface (customer projection, staff card, context section), decide the "not integrated" presentation for balances/bonus/referral subjects, extend the smoke with scenarios (b) and (f), then close PH-4 with a phase approval record.
Why now: PH-4.1 and PH-4.2 delivered the boundary, the summary and the cards; PH-4.3 is the closing block of the active phase.
Preconditions: CI green on the PH-4.2 commit (`gh run list --limit 3`, record it in `docs/evidence/PH-4.2-verification.md`); tree clean; `npm run verify` passes.
Evidence/read first: `docs/phases/PH-4.md` (scenarios b and f, "Verification"); `docs/features/FEAT-ORBIT/CONTEXT.md`; `PROJECT_CONTEXT.md` §6.2, §10.2, §14 items 7 and 10.
If preconditions fail: CI red → diagnose before any PH-4 work (§9.2). Unknown local changes → attribute and preserve (§4.3).
