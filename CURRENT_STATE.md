# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-5.md`; base checkpoint: the PH-5.1 commit on `main` (child of `9c64934`)

| Field | Value |
|---|---|
| Active objective / feature | PH-5 staff workspace completeness and supervision (OBJ-SUP-03): views for every state and attention signals (done), filters/search, saved replies, schedule/config with honest availability copy, supervision overview, service metrics. |
| Active phase / subphase | PH-5 `ACTIVE` (`docs/phases/PH-5.md`). PH-5.1 `APPROVED` 2026-09-14 (`docs/phases/PH-5.1.md`); PH-5.2 `PLANNED` (filters and search), PH-5.3 `PLANNED` (saved replies), PH-5.4 `PLANNED` (schedule, overview, metrics, closure). PH-1..PH-4 `APPROVED`. |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 1/3 (PH-4), open cycle, no debt. |
| Blocking decisions / dependencies | None. PH-4 depends on ADR-0002 (boundary) and BL-001 (resolved: everything simulated, DEC-0003). |
| Integration / CI / release | Candidate: the PH-5.1 commit on `main`. Local: `npm run verify` exit 0, `npm run build` exit 0, browser smoke 41/41 — `docs/evidence/PH-5.1-verification.md` (CI verdict recorded there when known). Previous: `d9f359f` CI green. Release: none, not authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0; earlier sessions ran on WSL2. The repo-local git author (DEC-0002) must be re-set on every fresh clone — see `docs/runbooks/VERIFICATION.md` "Setup". |
| Context route | `CONTEXT_INDEX.md` → four live feature contexts (all re-verified against the remediation commit); audit record `docs/audits/CYCLE-1.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Plan and run PH-5.2 (`docs/phases/PH-5.2.md`, to be created): filters and search on the staff list — `q` matching case reference (with or without the `SUP-` prefix), customer id, subject text and record reference; filters by category, priority and responsible agent; combined with any view and pagination; search box and filter controls in the queue; smoke step searching `WD-48213` and `cust-alice` (`PROJECT_CONTEXT.md` §5.2, scenario (d) of `docs/phases/PH-5.md`).
Why now: PH-5.1 made every state reachable; finding a specific case is the next block.
Preconditions: CI green on the PH-5.1 commit (`gh run list --limit 3`, record it in `docs/evidence/PH-5.1-verification.md`); tree clean; `npm run verify` passes.
Evidence/read first: `docs/phases/PH-5.md`; `docs/features/FEAT-STAFF/CONTEXT.md`; `PROJECT_CONTEXT.md` §5.2 (search fields), §10.2 (search must not reveal other customers' data beyond the case list staff already see).
If preconditions fail: CI red → diagnose before any PH-4 work (§9.2). Unknown local changes → attribute and preserve (§4.3).
