# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the PH-13.2 commit (after `cbcd3b4`): PH-13.1 and PH-13.2 approved; PH-13.3 waits for the Owner. Tag `v0.2.0-demo` on `dfd7a41` (local; push pending unless `git ls-remote --tags origin` already lists it). No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`; read `CLAUDE.md` from disk (an injected copy may be stale).

## Running now
None. Other Node processes and the `orbit-otc-*` containers on this machine belong to other projects — do not touch them. A native PostgreSQL service holds port 5433; the test compose uses 55433. The broker's repository `C:\Proyectos\optaqode-frontend2.0` was read, never modified; keep it that way (DEC-0045 e).

## Unfinished work
- Owner's side before PH-13.3: the service account in the broker's back-office (`auditor`, active, no 2FA) and its credentials in the API environment (`ORBIT_SERVICE_EMAIL` / `ORBIT_SERVICE_PASSWORD` — never in the repository), the dev API base URL, the host component mounted in the broker (`docs/integration/broker-host/OrbitSupportPanel.tsx`), the edge policy, the tag push (`git push origin v0.2.0-demo`, then rerun the red CI runs).
- PH-13.3 (live connection) and, later, the staff session inside the broker's back-office (designed as `x-orbit-actor: staff`, no web surface yet).
- PH-11 is the Owner's GPT build (`docs/phases/PH-11.md`). Retention, the e-mail provider and the AI provider account are the Owner's; any release beyond the demo needs the Owner (§1.1). Commits only through `bash scripts/gate-commit.sh <message-file> --include <new paths>`.

## Evidence and limits
- `docs/evidence/PH-13.1-verification.md`, `docs/evidence/PH-13.2-verification.md`; the reviewer's read-only reports of the broker are condensed in the map.
- No call was ever made to the broker's backend; the adapters and the embed are verified with fixtures, a fake `fetch` and jsdom only.

## Resume here
1. `git status -sb`; `gh run list --limit 2`; `git ls-remote --tags origin | grep v0.2.0-demo` — push the tag if absent and rerun CI.
2. If the Owner provided the service account and dev access: PH-13.3 (`CURRENT_STATE.md` "Next valid action"); otherwise nothing is the Agent's.

## Temporary environment notes
- Host: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook); Docker Desktop working (Engine 29.8.0).
- Git author is repo-local (DEC-0002); hook: `git config core.hooksPath scripts/git-hooks`.
- Dev database `apps/api/.data/pglite`, demo database `apps/api/.data/demo` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
