# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the cycle 3 out-of-band audit remediation commit (child of `dcc76e4`): 24 findings addressed (deployment files, test-database guard, identity-neutral render, role-model mirror, gate staging, recovery limits and characters, migration lock, web minors), migration `0018`, PH-8 reopened, corrected demo record. No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`; read `CLAUDE.md` from disk (an injected copy may be stale — FND-0081).

## Running now
None. The UI smoke and `scripts/demo-local.mjs` stop their own servers (3001, 3000, 3150). Reviewer instances of the audit (3041–3044) were stopped. Other Node processes on this machine belong to other projects — do not touch them.

## Unfinished work
Owner instruction (2026-09-14): «Ejecuta todo en orden» — (1) container rehearsal: BLOCKED by Docker Desktop on this host (stale sockets in `%LOCALAPPDATA%\Docker\run` need elevation; Owner action in `docs/evidence/RELEASE-2026-09-14.md` "Blocked"), which keeps PH-8.3 and PH-8 ACTIVE; (2) internal demo: `v0.1.0-demo` released, superseded by `v0.1.1-demo` (`docs/evidence/RELEASE-2026-09-14b.md`, tagged after CI); (3) out-of-band audit: remediation committed, closure next (see `CURRENT_STATE.md`). Pending the Owner's word: the demo's gate #5 reading (operating policies). Commits only through `bash scripts/gate-commit.sh <message-file> --include <new paths>`.

## Evidence and limits
- `docs/audits/CYCLE-3-OOB.md`, `docs/evidence/CYCLE-3-verification.md`, `docs/evidence/RELEASE-2026-09-14b.md`.
- Container images never built on this host; PostgreSQL verified in CI only; carried items BL-012 done, BL-022..BL-024 and BL-026..BL-030 with their revisit events.

## Resume here
1. `git status -sb`; `gh run list --limit 2` — the remediation commit must be green on both jobs.
2. Tag it `v0.1.1-demo`, record the CI verdict, close the audit (one gate commit); then report to the Owner.

## Temporary environment notes
- Host: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook). Paths in env vars are Windows-style (`C:/…`).
- Git author is repo-local (DEC-0002); hook: `git config core.hooksPath scripts/git-hooks`.
- Dev database `apps/api/.data/pglite`, demo database `apps/api/.data/demo`, uploads under `apps/api/.data/` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
