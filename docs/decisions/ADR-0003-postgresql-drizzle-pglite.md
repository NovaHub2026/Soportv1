# ADR-0003 — PostgreSQL dialect via Drizzle ORM; embedded PGlite for development and tests
Type: DECISION
Status: ACCEPTED
Recorded on: 2026-09-13
Decided on: 2026-09-13
Authority: Agent, delegated (`GOVERNANCE.md` §1.2: dependencies, architecture). `PROJECT_CONTEXT.md` §11 leaves database technology open.
Related: PH-1.2; RULE-SUP-03 (durable communication), RULE-SUP-09 (attributable history); ADR-0002

## Context and evidence
Cases, messages and events are relational data with ownership and history rules. No database server is available in the development environment (inspected 2026-09-13: `psql` client present, no server; Docker installed but daemon not running), and the Owner runs the project on WSL2 without infrastructure. Production will need concurrent access by several staff, which points to a real PostgreSQL server later.

## Decision and alternatives
- **Dialect: PostgreSQL**, from the first migration. Schema and queries are written once, in Drizzle ORM (`drizzle-orm` 0.45, `drizzle-kit` for SQL migrations committed under `apps/api/drizzle/`).
- **Engine for development and tests: PGlite** (`@electric-sql/pglite` 0.5, PostgreSQL compiled to WASM, in-process). In memory for tests; persisted to `apps/api/.data/pglite` (gitignored) for local development. Migrations run on open.
- **Engine for deployed environments: a PostgreSQL server** through `drizzle-orm/node-postgres`, selected by configuration in PH-8. Same schema, same migrations.

Alternatives: (a) SQLite for development and PostgreSQL later — rejected: two dialects, schema rewritten at the worst moment. (b) PostgreSQL in Docker from day one — rejected for now: adds a daemon dependency to every test run and to the Owner's machine; CI would need a service container. (c) Prisma — rejected: heavier toolchain and generated client in an ESM/TypeScript 6 workspace; less transparent SQL. (d) TypeORM — rejected: weaker typing and migration story than Drizzle for this size.

## Product effect, costs and risks
Cases and messages are durable across restarts (RULE-SUP-03) with an attributable event log (RULE-SUP-09). Costs: PGlite WASM startup (~0.3–0.5 s per test file); single connection per instance, so no multi-process access to one data directory. Risks: PGlite vs server PostgreSQL behavioral differences (extensions, some concurrency semantics) — contained by staying on core SQL and by running the integration suite against a real server before release.

## Verification, recovery and revisit conditions
PH-1.2 evidence: schema migrated and exercised by 15 service tests and 5 e2e tests on in-memory PGlite; persisted mode observed across an API restart. Revisit: at PH-8 (add a CI job against a PostgreSQL service container; choose hosting), or earlier if PGlite blocks a needed feature (e.g., full-text search extensions).
