# PH-1.3 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-1.3 — Customer "Suporte" panel
Recorded on: 2026-09-13 (runs 2026-09-14 00:20–00:37 UTC)
Revision: base `fd25efe` plus the PH-1.3 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: WSL2, Node v24.19.0, npm 11.17.0; Playwright 1.63.0 with Chromium headless shell build 1243 (Chrome 153). Missing system libraries (`libnspr4`, `libnss3`, `libasound2`) extracted from Ubuntu packages into the scratchpad and exposed via `LD_LIBRARY_PATH` (BL-007). Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Web lint and typecheck pass (React Compiler-era hooks rules included) | EXECUTED | `npm run lint -w web`; `npm run typecheck -w web` | exit 0. First attempt flagged `react-hooks/refs` (ref read during render in the new-request form) — fixed by holding the client message id in state |
| 2 | Component behavior | EXECUTED | `npm test -w web` — Vitest 4.1.11, jsdom, Testing Library | 4 files, 13 tests passed: pt-BR labels cover every shared status/category; time formatting; new-request form enables send only with topic + message, sends the simulated identity header and a `clientMessageId`, reuses the same id on retry after a failure; conversation shows reference/status/both sides with staff name, marks a failed send "Não enviada" and retries with the same id, shows the closure notice on `closed`, reports load errors; home groups active/previous, honest empty state, retry on error |
| 3 | The real panel works end to end in Chromium (desktop) | OBSERVED | `npm run build` then `SUPPORT_DB_DIR=<scratch> node scripts/ui-smoke.mjs` (headless Chromium 1280×800, `pt-BR`) | 8 observations, exit 0. Screenshots `screenshots/ph-1.3/01`–`06`: side panel with CTA and empty history; topic chips + message with send disabled until both present; case `SUP-000001` created and shown as "Recebido"; staff reply (posted through the API as "Ana", since the staff UI is PH-1.4) appeared in the customer panel within 15 s with status "Em atendimento"; customer follow-up from the composer; after reload the case is listed under "Conversas em andamento"; switching the simulated account to another customer shows an empty history (RULE-SUP-01) |
| 4 | Mobile layout | OBSERVED | Same smoke, viewport 390×844 | Panel hidden until "Suporte" is tapped, then full screen (`07-mobile-panel.png`). First run showed the topbar overflowing horizontally — fixed (nowrap button, compact picker, hidden duplicate badge, `min-width: 0`), rebuilt and re-observed |
| 5 | Smoke harness reliability | EXECUTED | Repeated smoke runs | A run after the rebuild failed because the previous run had orphaned a `next-server` on port 3150 serving a stale build (npx grandchild survived SIGTERM). Diagnosed with `ss -ltnp`; the script now spawns servers detached, kills the process group and refuses to start if a port is busy. Re-run: exit 0 and ports released |
| 6 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 7 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: screen readers / keyboard-only navigation beyond semantic markup (roles, labels, `aria-live`) — INSPECTED in code, not exercised; live delivery latency below the 5 s refresh (PH-2); real Orbit host placement (Orbit does not exist).

Limitations / reuse boundary: valid for this tree. Changes under `apps/web/src/**` require rerunning claims 1–2; visual or layout changes require the browser smoke (claims 3–4) after `npm run build`.

## Final gate run
`npm run verify`, 2026-09-14 00:37 UTC, on the completed PH-1.3 tree: `check-context: 15 documents, 154 links (2 gitignored skipped), 8 phases, 5 subphases, active: PH-1 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 15/15, web 13/13; overall exit 0. (A first attempt failed on five documentation paths written relative to `apps/web`; corrected to repository paths.)

## CI
Run `34793326034` on `5053df4` (PH-1.3 commit): **success** — `npm ci` and `npm run verify` green on ubuntu-latest, Node 24. Recorded 2026-09-14 00:45 UTC. Claim 7 is EXECUTED for `5053df4`.
