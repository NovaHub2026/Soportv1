# PH-2.2 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-2.2 — Delivery and unread states
Recorded on: 2026-09-13 (runs 2026-09-14 01:09–01:20 UTC)
Revision: base `411f5d9` plus the PH-2.2 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: WSL2, Node v24.19.0, npm 11.17.0; Playwright 1.63 / Chromium 1243 with the BL-007 workaround; offline emulated with Playwright `context.setOffline`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Unread counts and read markers behave per side; internal notes never count for customers; another customer cannot mark read | EXECUTED (incl. negatives) | `npm test -w api` (3 new tests) | 3 files, 24 tests passed |
| 2 | HTTP: `POST …/read` for customer (200 / 404 for another customer) and staff; `unreadCount` in lists drops after read | EXECUTED | `npm run test:e2e -w api` (`app.e2e-spec.ts` journey extended) | passed |
| 3 | Customer-wide stream `GET /api/support/cases/stream` carries own-case events (public only) and nothing from other customers | EXECUTED (negative) | `stream.e2e-spec.ts` new test | passed after FND-0003 (below). e2e total: 2 files, 10 tests |
| 4 | Web: unread badges (customer lists, staff queue), read marking on load, read receipt text for staff, connection indicator states, automatic resend of failed messages on `online` with the same `clientMessageId`, stream stale-watchdog reconnect | EXECUTED | `npm test -w web` | 6 files, 28 tests passed; lint and typecheck exit 0 |
| 5 | Integrated behavior in Chromium | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-2.2` | 18 observations, exit 0: staff queue shows "1 nova do cliente" and "Ao vivo" (`08`); opening the case clears the badge live; reply reaches the customer in 60 ms; staff see "Última resposta lida pelo cliente" within seconds of the customer panel receiving it; **offline**: message kept as "Não enviada" with "Reenviar" (`10`), then after `setOffline(false)` resent automatically and present exactly once on both sides; home shows "1 nova mensagem" within seconds of a new staff reply while the customer is on the home screen (`11`); opening clears it and staff see it as read |
| 6 | Finding **FND-0003** (MATERIAL): the customer-wide stream was mounted at `/api/support/stream` in the web client while the controller prefix made it `/api/support/cases/stream`, so the home never received live events (silent 404 behind reconnect backoff) | OBSERVED → EXECUTED | First smoke run failed at "home-unread-live"; a new e2e for the endpoint reproduced the 404; fixed path in web, tests and docs; e2e and smoke green | Lesson: every new endpoint gets an e2e before UI wiring; the smoke now saves failure screenshots |
| 7 | Finding **FND-0004** (MINOR): with the network off, the SSE connection can stay "connected" (no error) so recovery could not rely on the stream status alone | OBSERVED → EXECUTED | First smoke run timed out waiting for the indicator to leave "Ao vivo"; added `online`-event and 15 s periodic retry for failed messages and a 40 s stale-stream watchdog; unit tests for both | Recovery observed independent of the indicator |
| 8 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 9 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: real network drops (emulated only); read receipts when several staff work one case (single responsible agent by design until PH-5); accessibility of the badge beyond `aria-label` (screen-reader run not performed).

Limitations / reuse boundary: valid for this tree. Changes to read/unread logic, the stream client or the conversation components require claims 1–5 again.

## Final gate run
`npm run verify`, 2026-09-14 01:19 UTC, on the completed PH-2.2 tree: `check-context: 25 documents, 331 links (2 gitignored skipped), 8 phases, 9 subphases, active: PH-2 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 24/24, web 28/28; overall exit 0. `npm run build` exit 0 on the same tree (before the smoke).

## CI
Run `34795604031` on `c628d8b` (PH-2.2 commit): **success** — `npm ci` and `npm run verify` green on ubuntu-latest, Node 24. Recorded 2026-09-14 01:31 UTC. Claim 9 is EXECUTED for `c628d8b`.
