# PH-8.2 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-8.2 — PostgreSQL verification (BL-019, ADR-0003 revisit)
Recorded on: 2026-09-14
Revision: base `354be8a` plus the PH-8.2 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-4.1-verification.md`; Docker Desktop 29.7.2 installed on this host.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | With `SUPPORT_DATABASE_URL` unset nothing changes: the api unit and e2e suites run on PGlite exactly as before; `/api/health` reports `pglite (embedded PostgreSQL)` and would report `postgres (server)` behind the pool | EXECUTED | `npm test -w api` (`app.controller.spec.ts` extended), `npm run test:e2e -w api`, typecheck, lint | 65 / 34 tests passed |
| 2 | `createDatabase` opens a `pg` pool through `drizzle-orm/node-postgres` and applies the same migrations when the URL is set; services compile against the common `PgDatabase` type unchanged | EXECUTED | `npm run typecheck`, `npm run build` | exit 0 |
| 3 | Both suites against PostgreSQL 16 locally (Docker) | NOT EXECUTED on this host at recording time (Docker Desktop was installed but its engine did not come up within 10 minutes; the CI job is the authoritative run — claim 4) | `docker compose -f docker/compose.test.yml up -d` then `SUPPORT_DATABASE_URL=postgres://postgres:orbit@localhost:5433/orbit_test npm run test:pg -w api` | see "Local PostgreSQL run" |
| 4 | Both suites against PostgreSQL 16 in CI (service container, `verify-postgres` job) — concurrent takes, concurrent retries, overlapping closures, row locks under a real pool | NOT VERIFIED at recording time | `.github/workflows/ci.yml` job `api suites on PostgreSQL 16` | see "CI" |
| 5 | `apps/api/scripts/pg-reset.mjs` refuses any database whose name does not end in `_test` | EXECUTED | `SUPPORT_DATABASE_URL=postgres://x@localhost/orbit node apps/api/scripts/pg-reset.mjs` | exit 2, "Refusing to reset" |
| 6 | Full gate on the candidate | EXECUTED | `npm run gate` | see "Final gate run" |

Not verified: PostgreSQL behind a real pool on this host (claim 3) — the CI job carries that verdict; production-grade pool sizing and TLS to the database (PH-8.3 environment reference).

## Local PostgreSQL run
Not executed on this host: Docker Desktop 29.7.2 is installed and its processes started, but the Linux engine never became reachable (`docker info`: "failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine") within 10 minutes across three waits. The command to run once the engine is up: `docker compose -f docker/compose.test.yml up -d && SUPPORT_DATABASE_URL=postgres://postgres:orbit@localhost:5433/orbit_test npm run test:pg -w api`. The CI job `api suites on PostgreSQL 16` is the authoritative run for BL-019 (recorded under "CI" in the next record).

## Final gate run
`npm run verify` exit 0 at commit time through `scripts/gate-commit.sh` (check-context OK; lint/typecheck exit 0; Vitest shared 21/21, api 65/65, web 73/73, api e2e 34/34 — all on PGlite); `npm run build` exit 0.

## CI
Commit `c09c569`: run 34827035399 — job `verify` + build **success**; job `api suites on PostgreSQL 16` **failure**: the unit suites passed on PostgreSQL, then the two e2e files (run in parallel workers) raced on the migrator of the shared database (`CREATE SCHEMA IF NOT EXISTS "drizzle"` → duplicate key). The rule held; the harness did not. Fixed in the PH-8.3 commit (`test:pg` runs the e2e files without file parallelism and each file empties its tables first); the green run is recorded in `PH-8.3-verification.md`. Until then this approval stays conditional. Previous commit `354be8a` (PH-8.1): run 34826149511 **success**.
