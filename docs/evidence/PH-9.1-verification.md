# PH-9.1 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-9.1 — Case-domain debt (BL-022, BL-029, BL-013 API, BL-018)
Recorded on: 2026-09-14
Revision: base `c73b1b6` plus the PH-9.1 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: Windows 11 native, Git Bash, Node v24.19.0, npm 11.17.0. Sequential runs, in-memory PGlite.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | `awaitingReplySince` and `waitingInternalSince` follow their rules on every status, including rows older than migration `0017` and a case moved on while a consultation is open | EXECUTED | `npm test -w api` (`case-rules.spec.ts`) | 81 tests passed |
| 2 | Each job's `tick()`: an overlapping tick does nothing, a failure is logged and the next tick runs, the interval runs only when enabled and stops on shutdown, zero work is silent (ClosureJob, ReminderJob, NotificationJob) | EXECUTED | `npm test -w api` (`jobs.spec.ts`, 9 tests) | passed (within claim 1) |
| 3 | Internal notes: same key → same note, also under two concurrent calls; per-author keys; no key → a new note each time; a reply key replayed as a note → `ConflictException`; the customer never sees a note | EXECUTED | `npm test -w api` (`cases.service.spec.ts` PH-9.1) | passed (within claim 1) |
| 4 | `CasesService.remind` decides on the locked row: not after the case left `waiting_customer`, once per period, 404 for an unknown case; the existing reminder test (FND-0033 periods) passes through the job unchanged | EXECUTED | `npm test -w api` | passed (within claim 1) |
| 5 | Supervision: a case moved to `in_progress` with an open consultation counts as waiting for a team, its `oldestSince` is the consultation's request time, it appears once in the overdue list although it also awaits a reply, and leaves the count when the consultation is answered | EXECUTED | `npm test -w api` | passed (within claim 1) |
| 6 | The SQL twin used for queue ordering agrees with `awaitingReplySince` on seven cases covering every status | EXECUTED | `npm test -w api` | passed (within claim 1) |
| 7 | HTTP: customer detail and list, staff detail and queue, message and consultation responses parse with the shared schemas in strict mode (no extra, missing or mistyped field); the strict customer summary refuses a staff summary; a retried note over HTTP returns the same id; every earlier contract unchanged | EXECUTED | `npm run test:e2e -w api` | 35 tests passed |
| 8 | Types and lint after the shared schema change: api and web compile; the web suite is unchanged | EXECUTED | `npm run typecheck -w api`, `npm run lint -w api`, `npm run typecheck -w web`, `npm test -w web` | exit 0; web 78 passed |
| 9 | Full gate on the candidate | EXECUTED | `bash scripts/gate-commit.sh` | see "Final gate run" |
| 10 | CI executes the gate, the builds and the PostgreSQL suites on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: the browser — no screen changed in this subphase (§7.2: API-only behavior, covered by unit and e2e tests).

## Final gate run
`npm run verify` through `scripts/gate-commit.sh` at commit time: see the gate's `.gate-verify.log`; the result is recorded with the CI verdict in the next state update.

## CI
Pending at recording time; the verdict is recorded in `../../CURRENT_STATE.md` and in this record's successor.
