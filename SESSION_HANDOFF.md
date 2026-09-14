# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the PH-12.1 commit (after `9cba953`): PH-12 (project closure) opened, PH-12.1 approved. No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`; read `CLAUDE.md` from disk (an injected copy may be stale).

## Running now
None. The test PostgreSQL was stopped with `docker compose … down -v` (project `orbit-pgtest`). Other Node processes and the `orbit-otc-*` containers on this machine belong to other projects — do not touch them. A native PostgreSQL service holds port 5433; the test compose uses 55433.

## Unfinished work
PH-12 is active: PH-12.2 (closing audit) and PH-12.3 (hand-over: PH-11 brief, v0.2.0-demo, closure record) are planned in `docs/phases/PH-12.md`. PH-11 is the Owner's GPT build. Retention (legal advice) and the e-mail provider are the Owner's; any release beyond the demo needs the Owner (§1.1). Commits only through `bash scripts/gate-commit.sh <message-file> --include <new paths>` (it adds the `Gate-Verified:` trailer CI requires).

## Evidence and limits
- `docs/evidence/PH-10-phase-approval.md`, `docs/evidence/PH-10.1-verification.md` … `docs/evidence/PH-10.3-verification.md`; phase screenshots `docs/evidence/screenshots/ph-10/`.
- Browser observations come from the smoke; probe code stays in the session scratchpad (§11).

## Resume here
1. `git status -sb`; `gh run list --limit 2` — HEAD must be green.
2. Continue with PH-12.2 (`CURRENT_STATE.md` "Next valid action").

## Temporary environment notes
- Host: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook); Docker Desktop working (Engine 29.8.0).
- Git author is repo-local (DEC-0002); hook: `git config core.hooksPath scripts/git-hooks`.
- Dev database `apps/api/.data/pglite`, demo database `apps/api/.data/demo` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
