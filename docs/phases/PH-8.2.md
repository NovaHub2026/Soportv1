# PH-8.2 — PostgreSQL verification
Type: SUBPHASE TECHNICAL PLAN
Status: ACTIVE
Parent: `PH-8.md`
Feature context: `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Confirm the case domain's lock-in-transaction rule (DEC-0017) and every migration against a server PostgreSQL with a real connection pool, locally and in CI, closing BL-019 and the ADR-0003 revisit. Prerequisite: PH-8.1. Out of scope: replacing PGlite for development and the in-memory tests (they stay the fast path).

## Affected boundaries and implementation approach
- `apps/api/src/database/database.ts`: when `SUPPORT_DATABASE_URL` is set, `createDatabase` opens a `pg` pool through `drizzle-orm/node-postgres` and runs the same migrations; `Db` becomes the common `PgDatabase` type so services do not change.
- Scripts: `npm run test:pg -w api` runs the unit and e2e suites with `SUPPORT_DATABASE_URL` (each suite truncates its tables; the e2e uses a dedicated database); `docker compose -f docker/compose.test.yml up -d postgres` provides PostgreSQL 16 locally.
- CI: a second job with a `postgres:16` service container runs `test:pg` after `verify`.

## Required behavior, failures and acceptance evidence
- Both suites green against PostgreSQL locally (Docker) and in CI; the concurrent-take, concurrent-retry and overlapping-closure tests pass under the pool.
- Without `SUPPORT_DATABASE_URL` nothing changes (PGlite in memory / persisted).
Acceptance evidence: `../evidence/PH-8.2-verification.md` (to be created).

## Work performed and important decisions
Pending.

## Verification, limitations and context updates
Pending.
