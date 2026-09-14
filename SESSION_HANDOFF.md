# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the PH-8.3 re-approval commit (after `a863593`): container rehearsal and local PostgreSQL run recorded, PH-8 re-approved, ledger cycle 3 = 2/3. No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`; read `CLAUDE.md` from disk (an injected copy may be stale).

## Running now
None. The rehearsal and the test PostgreSQL were stopped with `docker compose … down -v` (projects `orbit-rehearsal`, `orbit-pgtest`); images remain in Docker. Other Node processes on this machine belong to other projects — do not touch them.

## Unfinished work
Nothing planned. Owner instructions carried out: «Ejecuta todo en orden» (demo `v0.1.1-demo`, out-of-band audit closed) and «Reintenta» (container rehearsal and local PostgreSQL run executed, PH-8 re-approved). Pending the Owner's word: the demo's gate #5 reading (operating policies), any release beyond the demo, new phases. Carried backlog items keep their revisit events (`docs/BACKLOG.md`). Commits only through `bash scripts/gate-commit.sh <message-file> --include <new paths>`.

## Evidence and limits
- `docs/evidence/PH-8.3-verification.md` "Rehearsal", `docs/evidence/PH-8.2-verification.md` "Local PostgreSQL run", `docs/evidence/PH-8-phase-approval.md` "Re-approval".
- The browser smoke runs against its own servers (fixed ports), not against the containers; the rehearsal used a scripted HTTP walk through the web.

## Resume here
1. `git status -sb`; `gh run list --limit 2` — HEAD must be green.
2. Wait for the Owner.

## Temporary environment notes
- Host: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook); Docker Desktop working (Engine 29.8.0).
- Git author is repo-local (DEC-0002); hook: `git config core.hooksPath scripts/git-hooks`.
- Dev database `apps/api/.data/pglite`, demo database `apps/api/.data/demo` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
