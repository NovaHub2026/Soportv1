# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the PH-8.1 commit: hardening (BL-012), waiting-for-team age (BL-021), accessibility basics (BL-024 partial), migration `0017`; PH-8 started, PH-8.1 approved, PH-8.2 active. No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None. The UI smoke stops its own servers (API 3001, web 3150). Other Node processes on this machine belong to other projects — do not touch them.

## Unfinished work
PH-8.2 (PostgreSQL verification, BL-019) is ACTIVE and not started in code (see `CURRENT_STATE.md` "Next valid action"); PH-8.3 (deployment and runbooks, phase closure) follows. Owner instruction in force (2026-09-14): «Continua automáticamente hasta finalizar todos los ciclos del proyecto» — continue autonomously through PH-8 without pausing; the production release itself still needs the Owner (§1.1) and the operational policies of BL-002 are Owner/Operations input that PH-8 must request, not invent. Commits go only through `npm run gate <message-file>` (`scripts/gate-commit.sh`). Carried audit items: `docs/BACKLOG.md` BL-012, BL-013, BL-014, BL-016..BL-019, BL-021..BL-024 with their revisit events (BL-016 closed by DEC-0029; BL-021 and BL-024 were due by the end of PH-7 and are carried into PH-8's first subphase — see `docs/BACKLOG.md`).

## Evidence and limits
- `docs/audits/CYCLE-2.md` (closed) and `docs/evidence/CYCLE-2-verification.md` (suites, builds, smoke, CI run 34822158367).
- Concurrency and claim-then-send delivery are verified on PGlite's single connection and by structure; BL-019 asks for the same suites against a server PostgreSQL before PH-8.
- The api suites' always-open schedule has one closed minute a day (23:59 local, FND-0051): a failure exactly then is a rerun, not a defect.

## Resume here
1. `git status -sb`; `gh run list --limit 2` — HEAD must be green.
2. Validate `CURRENT_STATE.md`; record the PH-8.1 CI verdict in `docs/evidence/PH-8.1-verification.md`; execute PH-8.2 from `docs/phases/PH-8.2.md`.

## Temporary environment notes
- Host observed 2026-09-14: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook). Paths in env vars are Windows-style (`C:/…`).
- Git author is repo-local and must be set on a fresh clone (DEC-0002); enable the hook with `git config core.hooksPath scripts/git-hooks`.
- Dev database: `apps/api/.data/pglite`; dev uploads: `apps/api/.data/uploads` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
- Playwright 1.63 / Chromium installed with `npx playwright install chromium`; on Windows no system-library workaround is needed (BL-007 applies to WSL2 only).
