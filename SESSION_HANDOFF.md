# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the PH-13.1 commit (after `aa82f75`): PH-13 opened (Orbit integration readiness), PH-13.1 approved. Tag `v0.2.0-demo` on `dfd7a41` (local; push pending unless `git ls-remote --tags origin` already lists it). No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`; read `CLAUDE.md` from disk (an injected copy may be stale).

## Running now
None. Other Node processes and the `orbit-otc-*` containers on this machine belong to other projects — do not touch them. A native PostgreSQL service holds port 5433; the test compose uses 55433. The broker's repository `C:\Proyectos\optaqode-frontend2.0` was read, never modified; keep it that way (DEC-0045 e).

## Unfinished work
- The tag push: `git push origin v0.2.0-demo` (the Agent's runtime refused it); until it lands, CI's `verify` job fails on every push with "tag v0.2.0-demo does not exist in this clone" — rerun the affected workflows after the push.
- PH-13.2 (panel inside the broker) and PH-13.3 (live connection, blocked by BL-032 — the backend questions in `docs/integration/ORBIT-INTEGRATION.md` §7). The provisional role map (DEC-0045 c) waits for the Owner's word on who supervises support.
- PH-11 is the Owner's GPT build (`docs/phases/PH-11.md`). Retention, the e-mail provider and the AI provider account are the Owner's; any release beyond the demo needs the Owner (§1.1). Commits only through `bash scripts/gate-commit.sh <message-file> --include <new paths>`.

## Evidence and limits
- `docs/evidence/PH-13.1-verification.md`; the reviewer's read-only report of the broker is condensed in the map (its scratch copy stays in the session scratchpad, §11).
- No call was ever made to the broker's backend; the adapters are verified with fixtures and a fake `fetch` only.

## Resume here
1. `git status -sb`; `gh run list --limit 2`; `git ls-remote --tags origin | grep v0.2.0-demo` — push the tag if absent and rerun CI.
2. Continue with PH-13.2 (`CURRENT_STATE.md` "Next valid action") after the Owner confirms where the panel ships (map §6).

## Temporary environment notes
- Host: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook); Docker Desktop working (Engine 29.8.0).
- Git author is repo-local (DEC-0002); hook: `git config core.hooksPath scripts/git-hooks`.
- Dev database `apps/api/.data/pglite`, demo database `apps/api/.data/demo` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
