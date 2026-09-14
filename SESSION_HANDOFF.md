# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the demo release commit (tag `v0.1.0-demo`): release record, `scripts/demo-local.mjs`, runbook updates. No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None. The UI smoke stops its own servers (API 3001, web 3150). Other Node processes on this machine belong to other projects — do not touch them.

## Unfinished work
Owner instruction (2026-09-14): «Ejecuta todo en orden» — (1) container rehearsal: BLOCKED by Docker Desktop on this host (stale sockets in %LOCALAPPDATA%\Docker\run need elevation; Owner action in `docs/evidence/RELEASE-2026-09-14.md` "Blocked"); (2) restricted demo release: DONE, `v0.1.0-demo` (new phases for real Orbit adapters or a mail provider were not opened — Orbit does not exist, a provider is a paid decision); (3) out-of-band Cycle Audit 3: next (see `CURRENT_STATE.md`). Commits go only through `npm run gate <message-file>`.

## Evidence and limits
- `docs/audits/CYCLE-2.md` (closed) and `docs/evidence/CYCLE-2-verification.md` (suites, builds, smoke, CI run 34822158367).
- Concurrency and claim-then-send delivery are verified on PGlite's single connection and by structure; BL-019 asks for the same suites against a server PostgreSQL before PH-8.
- The api suites' always-open schedule has one closed minute a day (23:59 local, FND-0051): a failure exactly then is a rerun, not a defect.

## Resume here
1. `git status -sb`; `gh run list --limit 2` — the release commit must be green.
2. Validate `CURRENT_STATE.md`; run Cycle Audit 3 (reviewer brief pattern in `docs/audits/CYCLE-2.md` "Scope, methods and limits").

## Temporary environment notes
- Host observed 2026-09-14: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook). Paths in env vars are Windows-style (`C:/…`).
- Git author is repo-local and must be set on a fresh clone (DEC-0002); enable the hook with `git config core.hooksPath scripts/git-hooks`.
- Dev database: `apps/api/.data/pglite`; dev uploads: `apps/api/.data/uploads` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
- Playwright 1.63 / Chromium installed with `npx playwright install chromium`; on Windows no system-library workaround is needed (BL-007 applies to WSL2 only).
