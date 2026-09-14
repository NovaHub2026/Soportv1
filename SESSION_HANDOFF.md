# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-13
Checkpoint: branch `main`; PH-2.3 commit (attachments: migration 0002, storage port, sniffing, endpoints, web composer/list, tests, smoke); no intended local delta after it
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None observed. The UI smoke stops its own servers (3001, 3150). Other Node processes on this machine (`apps/recorder`, `apps/settlement`, `next start … -p 3011/3012`, port 3100) belong to another project — do not touch them.

## Unfinished work
None in code. PH-2.4 not started. Owner instruction in force (2026-09-13): «Continua hasta el final sin parar».

## Evidence and limits
- `docs/evidence/PH-2.3-verification.md`: 26 api unit + 13 e2e + 33 web tests EXECUTED; 20 browser observations incl. attachment accepted/refused. CI verdict for this commit recorded there when available.
- Browser-environment workaround (BL-007) lives in the scratchpad; recreate per `docs/runbooks/VERIFICATION.md` if missing.

## Resume here
1. `git status -sb`; `gh run list --limit 3`.
2. Validate `CURRENT_STATE.md`; then start PH-2.4 as described there.

## Temporary environment notes
- Git author is repo-local: `NovaHub2026 <orbitmarket.pro@gmail.com>` (DEC-0002).
- Dev database: `apps/api/.data/pglite`; dev uploads: `apps/api/.data/uploads` (both gitignored). UI smoke must point `SUPPORT_DB_DIR` and `SUPPORT_UPLOADS_DIR` at scratch.
- Playwright 1.63 / Chromium 1243; missing system libs extracted in the scratchpad folder `browser-libs`, exported via `LD_LIBRARY_PATH`.
