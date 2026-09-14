# SESSION HANDOFF
Type: SESSION HANDOFF
Recorded on: 2026-09-13
Checkpoint: branch `main`; PH-2.1 commit (event bus, SSE endpoints, web stream client, live wiring in both UIs, ADR-0004, PH-2 phase doc); no intended local delta after it
Preservation: committed locally and pushed to `origin/main` at recording time — confirm with `git status -sb`

## Running now
None observed. The UI smoke stops its own servers (3001, 3150). Other Node processes on this machine (`apps/recorder`, `apps/settlement`, `next start … -p 3011/3012`, port 3100) belong to another project — do not touch them.

## Unfinished work
None in code. PH-2.2 not started. Owner instruction in force (2026-09-13): «Continua hasta el final sin parar».

## Evidence and limits
- `docs/evidence/PH-2.1-verification.md`: unit, e2e (stream negatives), client tests EXECUTED; live delivery OBSERVED at 73 ms / 129 ms through the Next rewrite. CI verdict for this commit recorded there when available.
- Browser-environment workaround (BL-007) lives in the scratchpad; recreate per `docs/runbooks/VERIFICATION.md` if missing.

## Resume here
1. `git status -sb`; `gh run list --limit 3`.
2. Validate `CURRENT_STATE.md`; then start PH-2.2 as described there.

## Temporary environment notes
- Git author is repo-local: `NovaHub2026 <orbitmarket.pro@gmail.com>` (DEC-0002).
- Dev database: `apps/api/.data/pglite` (gitignored). UI smoke must use `SUPPORT_DB_DIR` pointing to scratch.
- Playwright 1.63 / Chromium 1243; missing system libs extracted in the scratchpad folder `browser-libs`, exported via `LD_LIBRARY_PATH`.
