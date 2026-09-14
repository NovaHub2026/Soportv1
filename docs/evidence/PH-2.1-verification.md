# PH-2.1 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-2.1 — Live updates
Recorded on: 2026-09-13 (runs 2026-09-14 00:58–01:08 UTC)
Revision: base `b1cc4c6` plus the PH-2.1 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: WSL2, Node v24.19.0, npm 11.17.0; Playwright 1.63 / Chromium 1243 with the BL-007 workaround. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Service publishes `case.updated` / `message.created` after each committed write with summary and message payloads | EXECUTED | `npm test -w api` (new test in `cases.service.spec.ts`) | 3 files, 21 tests passed |
| 2 | Customer stream delivers a staff reply and heartbeats; never carries an internal-visibility message (RULE-SUP-04, negative) | EXECUTED | `npm run test:e2e -w api` (`stream.e2e-spec.ts`, real port via `app.listen(0)`, fetch streaming) | passed: heartbeat (300 ms test cadence), `message.created` for the reply, then an internal note published on the bus did not arrive while the following `case.updated` did |
| 3 | Stream authorization: another customer → 404 before any byte; no identity → 401; customer on the staff stream → 403 | EXECUTED (negative) | same e2e file | passed |
| 4 | Staff stream carries every change including internal notes | EXECUTED | same e2e file | passed. e2e total: 2 files, 9 tests |
| 5 | Client SSE parser and reconnect behavior | EXECUTED | `npm test -w web` (`sse.test.ts`): chunked/multi-line parsing, comments ignored; headers sent; statuses `connecting → connected → reconnecting`; reconnect after the server ends the stream; `closed` after stop | passed |
| 6 | Conversation applies a pushed message immediately without refetch; stream subscribed with the identity header | EXECUTED | `CaseConversation.test.tsx` (stream module mocked, handlers invoked) | passed. Web total: 6 files, 22 tests; lint and typecheck exit 0 |
| 7 | Live delivery end to end through the Next.js rewrite proxy, both directions | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-2.1` with a 3000 ms budget | staff reply reached the open customer panel in **73 ms**; customer follow-up reached the open staff case view in **129 ms** (previously up to 5 s); 12 observations, exit 0; no buffering by the rewrite proxy |
| 8 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 9 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: behavior behind a production reverse proxy or CDN (buffering/idle timeouts — PH-8); reconnection in a real browser after a network drop (unit-tested at the client, not exercised in Chromium); more than one API instance (in-process bus, ADR-0004 limitation).

Limitations / reuse boundary: valid for this tree. Changes under `apps/api/src/events/**`, the SSE endpoints, `apps/web/src/lib/sse.ts` or the stream consumers require claims 1–7 again.

## Final gate run
`npm run verify`, 2026-09-14 01:07 UTC, on the completed PH-2.1 tree: `check-context: 24 documents, 316 links (2 gitignored skipped), 8 phases, 9 subphases, active: PH-2 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 21/21, web 22/22; overall exit 0. `npm run build` exit 0 on the same tree (before the smoke).

## CI
Run `34794906584` on `411f5d9` (PH-2.1 commit): **success** — `npm ci` and `npm run verify` green on ubuntu-latest, Node 24. Recorded 2026-09-14 01:19 UTC. Claim 9 is EXECUTED for `411f5d9`.
