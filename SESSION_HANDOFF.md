# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-13
Checkpoint: branch `main`; PH-2.2 commit (read markers, unread counts, customer-wide stream, connection indicator, offline retry, stream watchdog, smoke with offline emulation); no intended local delta after it
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None observed. The UI smoke stops its own servers (3001, 3150). Other Node processes on this machine (`apps/recorder`, `apps/settlement`, `next start … -p 3011/3012`, port 3100) belong to another project — do not touch them.

## Unfinished work
None in code. PH-2.3 not started. Owner instruction in force (2026-09-13): «Continua hasta el final sin parar».

## Evidence and limits
- `docs/evidence/PH-2.2-verification.md`: unit/e2e/web tests EXECUTED; 18 browser observations incl. offline recovery and live unread badges; findings FND-0003 (wrong stream path) and FND-0004 (offline stream looks connected) fixed and re-verified.
- Browser-environment workaround (BL-007) lives in the scratchpad; recreate per `docs/runbooks/VERIFICATION.md` if missing.

## Resume here
1. `git status -sb`; `gh run list --limit 3`.
2. Validate `CURRENT_STATE.md`; then start PH-2.3 as described there.

## Temporary environment notes
- Git author is repo-local: `NovaHub2026 <orbitmarket.pro@gmail.com>` (DEC-0002).
- Dev database: `apps/api/.data/pglite` (gitignored). UI smoke must use `SUPPORT_DB_DIR` pointing to scratch.
- Playwright 1.63 / Chromium 1243; missing system libs extracted in the scratchpad folder `browser-libs`, exported via `LD_LIBRARY_PATH`.
