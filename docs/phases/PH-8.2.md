# PH-8.2 — PostgreSQL verification
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
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
Acceptance evidence: `../evidence/PH-8.2-verification.md`.

## Work performed and important decisions
- `apps/api/src/database/database.ts`: `createDatabase(dataDir, url = SUPPORT_DATABASE_URL)` — `pg` pool + `drizzle-orm/node-postgres` + its migrator when the URL is set, PGlite otherwise; `Db = PgDatabase<PgQueryResultHKT, typeof schema>` (services untouched); the handle reports its `driver` and `/api/health` says `postgres (server)` or `pglite (embedded PostgreSQL)`.
- `apps/api/scripts/pg-reset.mjs` (only `*_test` databases), `npm run test:pg -w api` (reset → unit suites without file parallelism → reset → e2e), `docker/compose.test.yml` (PostgreSQL 16 on 55433), CI job `verify-postgres` with a `postgres:16-alpine` service.
- Dependencies: `pg` 8.23, `@types/pg`. ADR-0003 revisit recorded in DEC-0032: PGlite stays the development and fast-test database; a PostgreSQL server is the deployment database and the second verification path.

## Verification, limitations and context updates
Evidence: `../evidence/PH-8.2-verification.md`. Limitations: the local Docker run depends on Docker Desktop's engine being up (see the evidence for what ran where); the CI job is the required verdict for BL-019.
Context updated: `PH-8.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-CASE/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`, `../runbooks/VERIFICATION.md`, `CLAUDE.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review) — the CI PostgreSQL job is green on `22cdb72` (run 34827685994, `../evidence/PH-8.3-verification.md`).
