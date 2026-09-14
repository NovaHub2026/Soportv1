# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-13
Checkpoint: branch `main`; PH-3.3 commit (transfer/release/reassignment with roles, priority/category edits, staff UI, tests, smoke); no intended local delta after it
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None observed. The UI smoke stops its own servers (3001, 3150). Other Node processes on this machine (`apps/recorder`, `apps/settlement`, `next start … -p 3011/3012`, port 3100) belong to another project — do not touch them.

## Unfinished work
None in code. PH-3.4 not started. Owner instruction in force (2026-09-13): «Continua hasta el final sin parar». Audit debt: 2/3 — the Cycle Audit is due right after PH-3's approval; plan independent subagent reviewers (§8.1).

## Evidence and limits
- `docs/evidence/PH-3.3-verification.md`: 34 api unit + 16 e2e + 38 web tests EXECUTED; browser observations incl. transfer, priority, release and retake. CI verdict for this commit recorded there when available.
- Browser-environment workaround (BL-007) lives in the scratchpad; recreate per `docs/runbooks/VERIFICATION.md` if missing.

## Resume here
1. `git status -sb`; `gh run list --limit 3`.
2. Validate `CURRENT_STATE.md`; then start PH-3.4 as described there.

## Temporary environment notes
- Git author is repo-local: `NovaHub2026 <orbitmarket.pro@gmail.com>` (DEC-0002).
- Dev database: `apps/api/.data/pglite`; dev uploads: `apps/api/.data/uploads` (gitignored). UI smoke must point `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR` at scratch.
- Playwright 1.63 / Chromium 1243; missing system libs extracted in the scratchpad folder `browser-libs`, exported via `LD_LIBRARY_PATH`.
