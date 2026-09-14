# Cycle 3 out-of-band audit — remediation verification evidence
Type: VERIFICATION EVIDENCE
Work item: remediation of FND-0058..FND-0081 (`docs/audits/CYCLE-3-OOB.md`)
Recorded on: 2026-09-14
Revision: base `dcc76e4` (tag `v0.1.0-demo`) plus the remediation working tree, committed as the next commit on `main` (this record travels with it — §3.4); it is also the candidate of the corrected demo release (`RELEASE-2026-09-14b.md`).
Environment: Windows 11 Pro 10.0.26200 (native, Git Bash), Node v24.19.0, npm 11.17.0; Playwright 1.63 with Chromium. No Docker engine (see `RELEASE-2026-09-14.md` "Blocked"). Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Shared: recovery fields refuse control and bidi characters (line breaks kept); contact formatting variants normalize to one contact; "take" claims an unowned case for every role | EXECUTED | `npm test -w @orbit-support/shared` | 23 tests passed |
| 2 | API: limiter sweeps expired keys; stream keys disappear with their last stream; the reformatted phone does not reset the per-contact limit; identity takes display names from the directory; every earlier behaviour unchanged | EXECUTED | `npm test -w api` | 66 tests passed |
| 3 | HTTP: a header name cannot impersonate a colleague (`authorName` = "Bruno Costa"); 30 refused uploads do not consume the quota (then 201); every earlier contract unchanged, with directory display names | EXECUTED | `npm run test:e2e -w api` | 34 tests passed |
| 4 | Web: server renders of the host and the workspace name nobody and carry `data-pending`; the context column and incident controls are disabled for a non-owner agent; a failed load after a view switch never shows the previous view's cases; scrolling inside the panel counts as activity; a sign-out in another tab clears this tab's drafts; queue paging with one extra row | EXECUTED | `npm test -w web` | 78 tests passed |
| 5 | The test guard refuses a database not named `*_test` | EXECUTED | `SUPPORT_DATABASE_URL=postgres://nobody@127.0.0.1:1/orbit_support npx vitest run …` in `apps/api` | exit 1, "Refusing to run the api test suites against \"orbit_support\"" |
| 6 | Schema and migrations agree after `0018` (back-fill of `waiting_internal_since`) | EXECUTED | `npm run db:generate -w api` | "No schema changes" |
| 7 | Static checks, production builds | EXECUTED | `npm run typecheck`, `npm run lint`, `npm run build` | exit 0 |
| 8 | Integrated behaviour in Chromium on the remediated build: every PH-1..PH-8 journey | OBSERVED | `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/cycle-3` | 54 observations, exit 0, screenshots `screenshots/cycle-3/01`–`29` (release-candidate set, DEC-0034) |
| 9 | Loopback demo post-release checks, incl. the identity-neutral server render | EXECUTED | `node scripts/demo-local.mjs --check` (fresh `apps/api/.data/demo`) | ok — see `RELEASE-2026-09-14b.md` |
| 10 | Full gate at commit time | EXECUTED | `bash scripts/gate-commit.sh … --include …` (the new staging rule, FND-0064) | see "Final gate run" |
| 11 | CI (both jobs) on the pushed commit | EXECUTED (post-integration) | `.github/workflows/ci.yml` | run 34840746414 on `e75b153`: `verify` + build **success**, `api suites on PostgreSQL 16` **success** |

Not verified: the Docker images and the compose rehearsal (no engine on this host — PH-8.3 stays ACTIVE for that); the advisory migration lock under two concurrent PostgreSQL starts (reasoned; CI runs one instance at a time); the idle timer's cross-tab sharing (by code; the in-panel scroll is tested).

## Final gate run
`npm run verify` exit 0 at commit time through `scripts/gate-commit.sh` with the new staging rule (check-context OK — ledger cycle 3 at 1/3 with the out-of-band record; lint/typecheck exit 0; Vitest shared 23/23, api 66/66, web 78/78, api e2e 34/34).

## CI
Commit `e75b153`: run 34840746414 — **success**, both jobs. Previous commit `dcc76e4` (tag `v0.1.0-demo`): run 34837013994 **success**, both jobs.
