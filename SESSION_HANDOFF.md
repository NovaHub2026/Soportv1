# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the Cycle Audit 2 closure / PH-7 start commit (child of `e3d843a`): audit record CLOSED with CI run 34822158367, ledger cycle 2 closed and cycle 3 opened at 0/3, `docs/phases/PH-7.md` and `PH-7.1.md` created, FEAT-ACCESS context created. No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None. The UI smoke stops its own servers (API 3001, web 3150). Other Node processes on this machine belong to other projects — do not touch them.

## Unfinished work
PH-7.1 is ACTIVE and not started in code (see `CURRENT_STATE.md` "Next valid action"). Owner instruction in force (2026-09-14): «Continua automáticamente hasta finalizar todos los ciclos del proyecto» — continue autonomously through PH-7 and PH-8 without pausing; the production release itself still needs the Owner (§1.1). Commits go only through `npm run gate <message-file>` (`scripts/gate-commit.sh`). Carried audit items: `docs/BACKLOG.md` BL-012, BL-013, BL-014, BL-016..BL-019, BL-021..BL-024 with their revisit events (BL-016 is decided in PH-7.2; BL-021 and BL-024 are due by the end of PH-7).

## Evidence and limits
- `docs/audits/CYCLE-2.md` (closed) and `docs/evidence/CYCLE-2-verification.md` (suites, builds, smoke, CI run 34822158367).
- Concurrency and claim-then-send delivery are verified on PGlite's single connection and by structure; BL-019 asks for the same suites against a server PostgreSQL before PH-8.
- The api suites' always-open schedule has one closed minute a day (23:59 local, FND-0051): a failure exactly then is a rerun, not a defect.

## Resume here
1. `git status -sb`; `gh run list --limit 2` — HEAD must be green.
2. Validate `CURRENT_STATE.md`; execute PH-7.1 from `docs/phases/PH-7.1.md`.

## Temporary environment notes
- Host observed 2026-09-14: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook). Paths in env vars are Windows-style (`C:/…`).
- Git author is repo-local and must be set on a fresh clone (DEC-0002); enable the hook with `git config core.hooksPath scripts/git-hooks`.
- Dev database: `apps/api/.data/pglite`; dev uploads: `apps/api/.data/uploads` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
- Playwright 1.63 / Chromium installed with `npx playwright install chromium`; on Windows no system-library workaround is needed (BL-007 applies to WSL2 only).
