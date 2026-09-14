# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-13
Checkpoint: branch `main`; PH-1.4 commit (staff workspace, staff API client, simulated staff session, smoke driving both UIs, screenshots, approval metadata); no intended local delta after it
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None observed. The UI smoke stops its own API (3001) and web (3150) servers and refuses to start if a port is busy. Other Node processes on this machine (`apps/recorder`, `apps/settlement`, `next start … -p 3011/3012`, port 3100) belong to another project — do not touch them.

## Unfinished work
None in code. PH-1.5 not started. Owner instruction in force (2026-09-13): «Continua hasta el final sin parar».

## Evidence and limits
- `docs/evidence/PH-1.4-verification.md`: 18 web component tests EXECUTED; integrated browser smoke OBSERVED (12 observations, 9 screenshots under `docs/evidence/screenshots/ph-1.4/`). CI verdict for this commit recorded there when available.
- Browser-environment workaround (BL-007) lives in the scratchpad; recreate per `docs/runbooks/VERIFICATION.md` if missing.

## Resume here
1. `git status -sb`; `gh run list --limit 3`.
2. Validate `CURRENT_STATE.md`; then start PH-1.5 as described there.

## Temporary environment notes
- Git author is repo-local: `NovaHub2026 <orbitmarket.pro@gmail.com>` (DEC-0002).
- Dev database: `apps/api/.data/pglite` (gitignored). UI smoke must use `SUPPORT_DB_DIR` pointing to scratch.
- Playwright 1.63 / Chromium 1243; missing system libs extracted in the scratchpad folder `browser-libs`, exported via `LD_LIBRARY_PATH`.
