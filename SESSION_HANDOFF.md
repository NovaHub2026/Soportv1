# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the Cycle Audit 3 closing commit (after `8c175fa`): PH-9 approved, Cycle Audit 3 closed (ledger cycle 3 CLOSED, cycle 4 at 0/3). No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`; read `CLAUDE.md` from disk (an injected copy may be stale).

## Running now
None. The test PostgreSQL was stopped with `docker compose … down -v` (project `orbit-pgtest`). Other Node processes and the `orbit-otc-*` containers on this machine belong to other projects — do not touch them. A native PostgreSQL service holds port 5433; the test compose uses 55433.

## Unfinished work
The Owner decided the operating policies (DEC-0039): PH-10 (policies in the product) is next, PH-11 (AI assistant first line) planned. Pending the Owner's word: retention (legal advice), the e-mail provider, the AI provider account, any release beyond the demo, BL-001. Commits only through `bash scripts/gate-commit.sh <message-file> --include <new paths>` (it adds the `Gate-Verified:` trailer CI requires).

## Evidence and limits
- `docs/evidence/PH-9-phase-approval.md`, `docs/audits/CYCLE-3.md`, `docs/evidence/CYCLE-3-closure-verification.md`.
- Probe code for browser observations stays in the session scratchpad (§11); the evidence records what each probe observed.

## Resume here
1. `git status -sb`; `gh run list --limit 2` — HEAD must be green.
2. Start PH-10 (`CURRENT_STATE.md` "Next valid action").

## Temporary environment notes
- Host: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook); Docker Desktop working (Engine 29.8.0).
- Git author is repo-local (DEC-0002); hook: `git config core.hooksPath scripts/git-hooks`.
- Dev database `apps/api/.data/pglite`, demo database `apps/api/.data/demo` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
