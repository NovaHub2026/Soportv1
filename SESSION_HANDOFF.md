# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the closing audit remediation commit (after `33e8794`): PH-12.2 closed (`docs/audits/CLOSING.md`, FND-0101..FND-0117, DEC-0044). No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`; read `CLAUDE.md` from disk (an injected copy may be stale).

## Running now
None. Reviewer probes ran on ports 3041–3044 from scratch builds and were stopped; nothing of theirs is in the repository (§11). Other Node processes and the `orbit-otc-*` containers on this machine belong to other projects — do not touch them. A native PostgreSQL service holds port 5433; the test compose uses 55433.

## Unfinished work
PH-12 is active: PH-12.3 (hand-over: demo release v0.2.0-demo, closure record, final state) is planned in `docs/phases/PH-12.md`; `docs/phases/PH-11.md` is the completed brief for the Owner's GPT build. Retention (legal advice) and the e-mail provider are the Owner's; any release beyond the demo needs the Owner (§1.1). Commits only through `bash scripts/gate-commit.sh <message-file> --include <new paths>` (it adds the `Gate-Verified:` trailer CI requires).

## Evidence and limits
- `docs/audits/CLOSING.md` (scope, methods, limits, findings), `docs/evidence/CLOSING-verification.md` (remediation claims); the reviewers' scratch artifacts stay in the session scratchpad.
- No browser run in the remediation; the release candidate runs the full smoke (PH-12.3).

## Resume here
1. `git status -sb`; `gh run list --limit 2` — HEAD must be green.
2. Continue with PH-12.3 (`CURRENT_STATE.md` "Next valid action").

## Temporary environment notes
- Host: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook); Docker Desktop working (Engine 29.8.0).
- Git author is repo-local (DEC-0002); hook: `git config core.hooksPath scripts/git-hooks`.
- Dev database `apps/api/.data/pglite`, demo database `apps/api/.data/demo` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
