# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-13
Checkpoint: branch `main`; PH-1.3 commit (customer panel, i18n, api client, simulated session, Playwright UI smoke, screenshots, approval metadata); no intended local delta after it
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None observed. The UI smoke starts and stops its own API (port 3001) and web (port 3150) processes; `pgrep -af 'apps/api/dist/main.js|next start -p 3150'` should list nothing from this project. Other Node processes on this machine (`apps/recorder`, `apps/settlement`, `next start … -p 3011/3012`, port 3100) belong to another project — do not touch them.

## Unfinished work
None in code. PH-1.4 not started. Owner instruction in force (2026-09-13): «Continua hasta el final sin parar».

## Evidence and limits
- `docs/evidence/PH-1.3-verification.md`: 13 component tests EXECUTED; browser smoke OBSERVED (8 observations, 7 screenshots). CI verdict for this commit recorded there when available.
- Environment workaround for Chromium system libraries (BL-007) lives in the scratch directory and must be recreated per the runbook if the scratchpad is gone.

## Resume here
1. `git status -sb`; `gh run list --limit 3`.
2. Validate `CURRENT_STATE.md`; then start PH-1.4 as described there.

## Temporary environment notes
- Git author is repo-local: `NovaHub2026 <orbitmarket.pro@gmail.com>` (DEC-0002).
- Dev database: `apps/api/.data/pglite` (gitignored). UI smoke must use `SUPPORT_DB_DIR` pointing to scratch.
- Playwright 1.63 with Chromium build 1243 in `~/.cache/ms-playwright`; missing system libs extracted under the scratchpad (folder `browser-libs`), exported through `LD_LIBRARY_PATH` when running the smoke.
