# PH-8.1 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-8.1 — Hardening and carried debt (BL-012, BL-021, BL-024 partial)
Recorded on: 2026-09-14
Revision: base `f6ae3f4` plus the PH-8.1 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | `SlidingWindowLimiter` allows `max` attempts per window per key, refuses the next with `retryAfterSeconds`, forgets attempts that left the window, keys are independent | EXECUTED | `npm test -w api` (`rate-limit.spec.ts`) | 65 tests passed |
| 2 | `CaseStreamService`: the ninth concurrent stream of one identity → 429; other identities unaffected; a released slot is reusable; counts return to 0 | EXECUTED | `npm test -w api` (`case-stream.service.spec.ts`) | passed (within claim 1) |
| 3 | Supervision: a `waiting_internal` case older than the threshold is overdue, `waitingInternal.count/oldestSince` reported, `waitingInternalSince` present for staff and absent from the customer list (BL-021) | EXECUTED | `npm test -w api` (`cases.service.spec.ts` PH-5.4 test extended) | passed (within claim 1) |
| 4 | HTTP: every response carries `x-content-type-options: nosniff`, `x-frame-options`, `strict-transport-security` and no `x-powered-by`; `GET /api/nope` and `GET /nope` → JSON 404; the overview carries `waitingInternal`; every earlier contract unchanged | EXECUTED | `npm run test:e2e -w api` (PH-8.1 test) | 34 tests passed |
| 5 | Web: the queue shows "Aguardando a equipe há …", the supervision demand lists "Aguardando equipe interna", focus moves to the panel title after "Voltar", units come from the dictionary; every earlier test unchanged | EXECUTED | `npm test -w web`, typecheck | 73 tests passed |
| 6 | Schema and migrations agree after `0017` | EXECUTED | `npm run db:generate -w api` produced only `0017` | no drift |
| 7 | Integrated behaviour in Chromium under the new headers, caps and 404 handling: every PH-1..PH-7 journey | OBSERVED | `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-8.1` after `npm run build` | see "Smoke" |
| 8 | Full gate on the candidate | EXECUTED | `npm run gate` | see "Final gate run" |
| 9 | CI executes the gate and the builds on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: the upload limit over HTTP (31 uploads; the limiter is unit-tested and the call site is one line); the SSE cap over HTTP (supertest cannot hold eight open streams; unit-tested on the service); the bind-address warning (reasoned from `main.ts`, exercised by the PH-8.3 rehearsal).

## Smoke
54 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-8.1/01`–`29`. No new observation: the controls change what is refused, and every existing journey passed unchanged under helmet's headers and the stream cap (each browser page holds at most two streams).

## Final gate run
`npm run build` (shared, nest, next) exit 0 before the smoke; `npm run verify` exit 0 at commit time through `scripts/gate-commit.sh` (check-context OK; lint/typecheck exit 0; Vitest shared 21/21, api 65/65, web 73/73, api e2e 34/34).

## CI
Pending push. Previous commit `f6ae3f4` (PH-7.3): run 34825250815 **success**.
