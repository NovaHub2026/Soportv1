# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-14
Checkpoint: branch `main`; the PH-12.3 closure commit (after `dfd7a41`): PH-12 approved, the project closed except PH-11. Tag `v0.2.0-demo` on `dfd7a41` (local; push pending unless `git ls-remote --tags origin` already lists it). No intended local delta after it.
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`; read `CLAUDE.md` from disk (an injected copy may be stale).

## Running now
None. The demo servers of `scripts/demo-local.mjs --check` stopped themselves; the demo database `apps/api/.data/demo` (gitignored) holds the check's one case. Other Node processes and the `orbit-otc-*` containers on this machine belong to other projects — do not touch them. A native PostgreSQL service holds port 5433; the test compose uses 55433.

## Unfinished work
- The tag push: the Agent's runtime refused `git push origin v0.2.0-demo` (an outward-facing action); the Owner runs it once — the tag is annotated and already points at the CI-green candidate (run 34875569705).
- PH-11 is the Owner's GPT build (`docs/phases/PH-11.md`, "How to start"). Retention (legal advice), the e-mail provider and the AI provider account are the Owner's; any release beyond the demo needs the Owner (§1.1). Commits only through `bash scripts/gate-commit.sh <message-file> --include <new paths>` (it adds the `Gate-Verified:` trailer CI requires).

## Evidence and limits
- `docs/evidence/PH-12-phase-approval.md` (closure record), `docs/evidence/RELEASE-2026-09-14c.md` (release gate, notes, post-release checks), `docs/audits/CLOSING.md`, `docs/evidence/CLOSING-verification.md`; screenshots `docs/evidence/screenshots/release-v0.2.0-demo/`.
- Browser observations come from the smoke; probe code stays in the session scratchpad (§11).

## Resume here
1. `git status -sb`; `gh run list --limit 2` — HEAD must be green; `git ls-remote --tags origin | grep v0.2.0-demo` — push the tag if absent.
2. Nothing else is the Agent's; `CURRENT_STATE.md` "Next valid action" lists the Owner's steps.

## Temporary environment notes
- Host: Windows 11 native (Git Bash for the agent's shell; PowerShell forms in the runbook); Docker Desktop working (Engine 29.8.0).
- Git author is repo-local (DEC-0002); hook: `git config core.hooksPath scripts/git-hooks`.
- Dev database `apps/api/.data/pglite`, demo database `apps/api/.data/demo` (gitignored). The UI smoke refuses to run without `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR`.
