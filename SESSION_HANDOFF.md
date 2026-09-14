# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-13
Checkpoint: branch `main`; PH-3.5 commit (shared incidents, migration 0006, staff incident section, PH-3 approval, ledger 3/3, Cycle Audit 1 opened); no intended local delta after it
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None observed. The UI smoke stops its own servers (3001, 3150). Other Node processes on this machine (`apps/recorder`, `apps/settlement`, `next start … -p 3011/3012`, port 3100) belong to another project — do not touch them.

## Unfinished work
Cycle Audit 1 is OPEN and is the only permitted mode of work (plus urgent containment) until it closes. Owner instruction in force (2026-09-13): «Continua hasta el final sin parar» — the audit is part of that continuation, not a pause for the Owner.

## Evidence and limits
- `docs/evidence/PH-3.5-verification.md`, `docs/evidence/PH-3-phase-approval.md`. CI verdict for this commit recorded in the PH-3.5 file when available.
- Browser-environment workaround (BL-007) lives in the scratchpad; recreate per `docs/runbooks/VERIFICATION.md` if missing.

## Resume here
1. `git status -sb`; `gh run list --limit 3`.
2. Validate `CURRENT_STATE.md`; continue Cycle Audit 1 from `docs/audits/CYCLE-1.md`.

## Temporary environment notes
- Git author is repo-local: `NovaHub2026 <orbitmarket.pro@gmail.com>` (DEC-0002).
- Dev database: `apps/api/.data/pglite`; dev uploads: `apps/api/.data/uploads` (gitignored). UI smoke must point `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR` at scratch.
- Playwright 1.63 / Chromium 1243; missing system libs extracted in the scratchpad folder `browser-libs`, exported via `LD_LIBRARY_PATH`.
