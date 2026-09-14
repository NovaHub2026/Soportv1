# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; `d9f359f` (PH-4.3: not-found and outage flows in the smoke, not-integrated subjects in the staff section; PH-4.3 and PH-4 approved, ledger cycle 2: 1/3) plus the CI-verdict commit that follows it. No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None. The UI smoke stops its own servers (API 3001, web 3150). Reviewer API instances used during the audit (ports 3021, 3023, 3029, 3199) were stopped by their reviewers. Other Node processes on this machine belong to other projects — do not touch them.

## Unfinished work
None in progress. PH-4 is approved; PH-5 is next — plan `docs/phases/PH-5.md` (to be created) before coding (see `CURRENT_STATE.md`). Carried audit items live in `docs/BACKLOG.md` BL-011..BL-019 with their revisit events.

## Evidence and limits
- `docs/evidence/PH-4.3-verification.md` and `docs/evidence/PH-4-phase-approval.md` (verify:full, browser smoke 40 observations incl. not-found and outage; CI verdict for the PH-4.3 commit recorded in the PH-4.3 record when available). Earlier: `docs/evidence/PH-4.2-verification.md`, `docs/evidence/PH-4.1-verification.md`, `docs/evidence/CYCLE-1-verification.md` (all CI green).
- Concurrency fixes (FND-0009) are verified on PGlite's serialized connection and by structure (row locks); BL-019 asks for the same suites against a server PostgreSQL before PH-8.
- The Owner instruction «Continua hasta el final sin parar» (2026-09-13) remains in force: continue autonomously into PH-4.

## Resume here
1. `git status -sb`; `gh run list --limit 3` (`d9f359f` is green: run 34812963182; the CI-verdict commit's own run is documentation only).
2. Validate `CURRENT_STATE.md`; plan `docs/phases/PH-5.md` (to be created) and start PH-5.1.

## Temporary environment notes
- Host observed 2026-09-14: Windows 11 native (Git Bash for the agent's shell), not WSL2. Paths in env vars must be Windows-style (`C:/…`).
- Git author is repo-local and must be set on a fresh clone: `git config --local user.name NovaHub2026 && git config --local user.email orbitmarket.pro@gmail.com` (DEC-0002).
- Dev database: `apps/api/.data/pglite`; dev uploads: `apps/api/.data/uploads` (gitignored). UI smoke must point `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR` at scratch.
- Playwright 1.63 / Chromium installed with `npx playwright install chromium`; on Windows no system-library workaround is needed (BL-007 applies to WSL2 only).
