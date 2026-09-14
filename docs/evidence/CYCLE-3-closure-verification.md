# Cycle Audit 3 — Remediation verification
Type: VERIFICATION EVIDENCE
Work item: remediation of FND-0082..FND-0100 (`../audits/CYCLE-3.md`)
Recorded on: 2026-09-14
Revision: base `c9618c8` plus the remediation working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: Windows 11 native, Git Bash, Node v24.19.0, npm 11.17.0, Playwright Chromium (headless), Docker Engine 29.8.0 (PostgreSQL 16 test container on 127.0.0.1:55433).

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | FND-0082: a note's key replayed as a public reply → `ConflictException`; the customer sees no extra message | EXECUTED | `npm test -w api` (`cases.service.spec.ts`, Cycle Audit 3 block) | 92 passed, 1 skipped (the PostgreSQL-only test on PGlite) |
| 2 | FND-0083: IPv4 keyed by address, IPv4-mapped IPv6 by its IPv4 address, IPv6 by /64 (zone ids and embedded IPv4 handled) | EXECUTED | `npm test -w api` (`client-bucket.spec.ts`) | passed (within claim 1) |
| 3 | FND-0084: the `waiting_internal` view lists a case moved to `in_progress` with an open consultation, oldest wait first; its summary carries the age; a case owed nothing has none; the view's length equals supervision's count; the SQL twin agrees with the rule on every row | EXECUTED | `npm test -w api` | passed (within claim 1) |
| 4 | FND-0085: five stale uploads are removed in one run with batches of two | EXECUTED | `npm test -w api` | passed (within claim 1) |
| 5 | FND-0086: an upload removed by the cleanup fails the send (400) and the creation (400, no case left) | EXECUTED | `npm test -w api` | passed (within claim 1) |
| 6 | FND-0086 on PostgreSQL: a cleanup that meets a link holding the row lock leaves the linked file | EXECUTED | `docker compose -f docker/compose.test.yml -p orbit-pgtest up -d --wait`; `SUPPORT_DATABASE_URL=postgres://postgres:orbit@localhost:55433/orbit_test npm run test:pg -w api`; `down -v` | unit 93/93 (the PostgreSQL-only test included), e2e 37/37; container removed |
| 7 | Every earlier HTTP contract unchanged | EXECUTED | `npm run test:e2e -w api` | 37 passed |
| 8 | FND-0087/0088/0089/0090/0091/0092/0093 (web): an edited note after a failure gets a new key and the same text keeps it; a failed reply's key never becomes a note's; no send while an upload runs (new request, conversation); "reconnecting" before any backoff time passes; mobile toggle and '×'; a panel closed on desktop stays closed across the breakpoint; a notice with missing data keeps its text; an unavailable staged file is named and the next send goes without it | EXECUTED | `npm test -w web` (twice) | 98 passed, both runs |
| 9 | FND-0096: on a disposable worktree, a second edit to an already-modified file leaves the old status-only hash unchanged and changes the new hash (status + `git diff HEAD`) | EXECUTED | bash reproduction of both hash functions, worktree removed | old UNCHANGED, new changed |
| 10 | FND-0098: the gate writes `Gate-Verified: verify exit 0; tests …` into the commit; the CI `verify` job refuses a pushed commit without it | EXECUTED (the trailer, at commit time) / NOT VERIFIED (the CI step, at recording time) | `scripts/gate-commit.sh`, `.github/workflows/ci.yml` | see the commit and its CI run |
| 11 | FND-0095/0100: check-context passes on the corrected contexts, index and sorted decision log, reading the ledger record as the first non-out-of-band `.md` path | EXECUTED | `npm run check:context` | OK at commit time |
| 12 | FND-0094: every PH-1..PH-9 journey in Chromium, now including a file on the very first message (SUP-000006 opened with the image on message 1) and the desktop close control | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs <scratch>` | exit 0, 56 observations; the two new screenshots kept as `screenshots/cycle-3/30`, `31` (DEC-0034 c) |
| 13 | Static layers and production builds | EXECUTED | `npm run typecheck`, `npm run lint`, `npm run build` | exit 0 |

## Limits
- FND-0098 cannot prove that past commits came through the gate; it holds from this commit on.
- The PostgreSQL race test (claim 6) orders the link and the cleanup with short waits; it shows the guard holding when the cleanup meets a held lock, not every interleaving.
- A silent network drop still keeps "Ao vivo" until the stale-stream watchdog fires (FND-0089, documented).

## CI of the remediation commit
`7d6404f`: run 34861942932 failed before any job started — the new "came through the gate" step had an unquoted `: ` in its `run:` value, which YAML reads as a mapping, so GitHub rejected the workflow file (no suite ran). The next commit writes the command as a block scalar and was parsed locally before the push; its run is recorded at closure.

## CI
Commit `8c175fa`: run 34862165475 — **success** on both jobs (`verify` with the full-history checkout and the "came through the gate" step, and the api suites on PostgreSQL 16). Claim 10's CI part is verified by it.
