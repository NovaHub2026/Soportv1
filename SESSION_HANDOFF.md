# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the PH-8.3 commit: Dockerfiles, compose, `.env.example`, deployment/release/operations runbooks; PH-8.3 and PH-8 approved, ledger cycle 3 = 2/3 — every planned phase delivered. No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None. The UI smoke stops its own servers (API 3001, web 3150). Other Node processes on this machine belong to other projects — do not touch them.

## Unfinished work
No phase is active or planned. Outstanding: the container rehearsal (`docker compose -f docker/compose.yml up -d --build`) on a host whose Docker engine works — Docker Desktop on this host never exposed its engine during PH-8 (check `docker info`); record the result in `docs/evidence/PH-8.3-verification.md`. Then the Owner decides the next step (release authorization per `docs/runbooks/RELEASE.md`, new phases, or an out-of-band audit). Owner instruction in force (2026-09-14): «Continua automáticamente hasta finalizar todos los ciclos del proyecto» — fulfilled through PH-8; the production release itself still needs the Owner (§1.1), Orbit's adapters (BL-001) and the operating policies (BL-002). Commits go only through `npm run gate <message-file>` (`scripts/gate-commit.sh`). Carried audit items: `docs/BACKLOG.md` BL-012, BL-013, BL-014, BL-016..BL-019, BL-021..BL-024 with their revisit events (BL-016 closed by DEC-0029; BL-021 and BL-024 were due by the end of PH-7 and are carried into PH-8's first subphase — see `docs/BACKLOG.md`).

## Evidence and limits
- `docs/audits/CYCLE-2.md` (closed) and `docs/evidence/CYCLE-2-verification.md` (suites, builds, smoke, CI run 34822158367).
- Concurrency and claim-then-send delivery are verified on PGlite's single connection and by structure; BL-019 asks for the same suites against a server PostgreSQL before PH-8.
- The api suites' always-open schedule has one closed minute a day (23:59 local, FND-0051): a failure exactly then is a rerun, not a defect.

## Resume here
1. `git status -sb`; `gh run list --limit 2` — HEAD must be green.
2. Validate `CURRENT_STATE.md`; record both CI verdicts of the PH-8.3 commit in `docs/evidence/PH-8.3-verification.md`; run the container rehearsal if an engine is available; otherwise wait for the Owner.

## Temporary environment notes
- Host observed 2026-09-14: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook). Paths in env vars are Windows-style (`C:/…`).
- Git author is repo-local and must be set on a fresh clone (DEC-0002); enable the hook with `git config core.hooksPath scripts/git-hooks`.
- Dev database: `apps/api/.data/pglite`; dev uploads: `apps/api/.data/uploads` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
- Playwright 1.63 / Chromium installed with `npx playwright install chromium`; on Windows no system-library workaround is needed (BL-007 applies to WSL2 only).
