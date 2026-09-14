# Cycle Audit 2 — Remediation verification evidence
Type: VERIFICATION EVIDENCE
Work item: Cycle Audit 2 remediation (`docs/audits/CYCLE-2.md`, findings FND-0030..FND-0056)
Recorded on: 2026-09-14
Revision: base `70630c4` plus the remediation working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: Windows 11 Pro 10.0.26200 (native, Git Bash), Node v24.19.0, npm 11.17.0; Playwright 1.63 with Chromium. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | An unknown or NUL-bearing time zone is refused (400 `invalid_timezone` / `invalid_characters`), a stored unknown zone fails closed, the single-open-day next opening is next week, booleans are not coerced (FND-0030, FND-0043, FND-0048) | EXECUTED | `npm test -w @orbit-support/shared` (`settings.test.ts`) | 17 tests passed |
| 2 | Interval env values outside [1, 2^31−1] or non-integer fall back with a warning; `off` switches are case-insensitive (FND-0031) | EXECUTED | `apps/api/src/common/env.spec.ts` | passed (within claim 3) |
| 3 | E-mails due during an Orbit outage stay unmarked and go out after recovery (FND-0032); the reminder waits from the entry into `waiting_customer`, a staff message while waiting restarts it, an old staff reply does not count (FND-0033); a follow-up opened outside hours gets the notice (FND-0042); every earlier api behaviour unchanged | EXECUTED | `npm test -w api` | 59 tests passed (57 before + `env.spec.ts`; the PH-6.2 and PH-6.3 tests extended) |
| 4 | HTTP: `PUT /api/staff/settings` with `timezone: "Mars/Olympus"` → 400 naming `timezone`, with `attentionThresholdHours: true` → 400; availability keeps answering 200 (FND-0030, FND-0048); every earlier contract unchanged | EXECUTED | `npm run test:e2e -w api` | 30 tests passed (the PH-6.3 test extended with the two negatives) |
| 5 | Web: host re-renders open no new stream (FND-0034); a customer switch never shows the previous customer's notifications even when the new list fails (FND-0035); "Carregar mais" stops at the API limit and a failed refresh flags the list with a retry (FND-0036); a failed preference save is reported and the previous value kept, a failed outbox load says so (FND-0041) | EXECUTED | `npm test -w web` | 65 tests passed (61 before + 4 regression tests: `OrbitShell.test.tsx` FND-0034/FND-0035, `StaffWorkspace.test.tsx` FND-0036, `SupportHome.test.tsx` FND-0041) |
| 6 | Schema and migrations agree after `0015` (`waiting_customer_since` with its backfill) | EXECUTED | `npm run db:generate -w api` produced only `0015`; a second run: "No schema changes, nothing to migrate" | no drift |
| 7 | Static checks and full gate on the remediated tree | EXECUTED | `npm run verify` through `scripts/gate-commit.sh` | see "Final gate run" |
| 8 | Production builds | EXECUTED | `npm run build` (shared, nest, next) | exit 0 |
| 9 | Integrated behaviour in Chromium after remediation: every PH-1..PH-6 journey, the outside-hours "Aviso" label asserted, the smoke refusing to run without `SUPPORT_UPLOADS_DIR` | OBSERVED | `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/cycle-2` | see "Smoke" |
| 10 | Context documents consistent, no PLACEHOLDER token, cycle-specific ledger echo (FND-0037, FND-0038) | EXECUTED | `node scripts/check-context.mjs` (part of `verify`) | see "Final gate run" |
| 11 | CI executes `verify` and now the builds on the pushed commit (FND-0052) | EXECUTED (post-integration) | `.github/workflows/ci.yml` | see "CI" |

Not verified: the claim-then-send behaviour under two API instances (PGlite is single-process; BL-019 covers PostgreSQL); reminders after a real hour in a browser; the pre-commit hook on a machine other than this one (enabled here with `git config core.hooksPath scripts/git-hooks` and observed running `check:context` on the remediation commit).

## Smoke
49 observations, exit 0 (2026-09-14), screenshots `screenshots/cycle-2/01`–`25`: every PH-1..PH-6 journey passed on the remediated build; the outside-hours step now also waits for the "Aviso" label (FND-0050); the PH-6.2 e-mail step counts only the staff-reply e-mail; a run without `SUPPORT_UPLOADS_DIR` exits 2 with "Refusing to run without SUPPORT_UPLOADS_DIR" (FND-0053) — checked by hand before this run.

## Final gate run
`npm run verify` exit 0 at commit time through `scripts/gate-commit.sh` (the first commit produced by the repository copy of the script, with the `pre-commit` hook running `check:context`): check-context OK — 81 documents, ledger echo cycle-specific, no placeholder token; lint (0 warnings) and typecheck exit 0; Vitest shared 17/17, api 59/59, web 65/65, api e2e 30/30. `npm run build` (shared, nest, next) exit 0 before the smoke.

## CI
Remediation commit `e3d843a`: run 34822158367 — **success** (`verify` and, for the first time, the production builds in CI).
