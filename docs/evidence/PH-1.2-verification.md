# PH-1.2 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-1.2 — Case domain and API
Recorded on: 2026-09-13 (runs 2026-09-14 00:10–00:20 UTC)
Revision: base `151d31f` plus the PH-1.2 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: WSL2, Node v24.19.0, npm 11.17.0; `npm install` after adding dependencies (drizzle-orm 0.45.2, @electric-sql/pglite 0.5.8, drizzle-kit 0.31.10, zod 4.6.5). Sequential runs; no edits to the checked scope during a run.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Shared contracts build and their unit tests pass | EXECUTED | `npm run build:shared`; `npm test -w @orbit-support/shared` | build exit 0 (`dist/` with `.d.ts`); 1 file, 7 tests passed |
| 2 | Migration generated from the Drizzle schema matches the intended model | EXECUTED + INSPECTED | `npm run db:generate -w api`; read `apps/api/drizzle/0000_misty_baron_zemo.sql` | 3 tables, 6 enums; `reference_number` is `GENERATED ALWAYS AS IDENTITY` with a unique index; partial unique index `(author_id, client_message_id) WHERE client_message_id IS NOT NULL`; FKs cascade on delete |
| 3 | API type-checks and lints | EXECUTED | `npm run typecheck`; `npm run lint` (root) | exit 0 for shared, api, web |
| 4 | Service rules hold on embedded PostgreSQL | EXECUTED | `npm test -w api` (Vitest, in-memory PGlite, migrations applied on open) | 2 files, 15 tests passed in 3.0 s — reference format/sequence, idempotent create, own-cases-only, other customer → NotFound (negative, RULE-SUP-01), internal note hidden from customer / visible to staff (negative, RULE-SUP-04), FIFO unassigned queue, take → assignment + events, take by another agent → Conflict (negative), reply visible to customer + auto-assign, resolved → reopened, waiting_customer → in_progress, idempotent message, closed → Conflict |
| 5 | HTTP surface behaves (auth, validation, journey) | EXECUTED | `npm run test:e2e -w api` (supertest against `AppModule` + `configureApp`) | 1 file, 5 tests passed — health labels simulation; 401 without identity, 403 wrong actor kind (negatives); 400 structured issues for bad body / bad view / bad uuid; full PH-1 journey request → queue → take → reply → customer view, plus 404 for another customer |
| 6 | The built API starts, serves HTTP and persists across a restart | OBSERVED | `nest build`; `PORT=3101 SUPPORT_DB_DIR=<scratch> node dist/main.js`; `curl` health, `POST /api/support/cases`; kill; start again; `GET /api/support/cases` | health `{"status":"ok","identity":"simulated"}`; case `SUP-000001` created; after restart the list returns the same case id and reference; process stopped afterwards |
| 7 | Full gate passes on the candidate | EXECUTED | `npm run verify` (context + build:shared + lint + typecheck + unit) | see "Final gate run" |
| 8 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: concurrency race on duplicate `clientMessageId` (handled by unique index + retry lookup, not load-tested); behavior on a server PostgreSQL (ADR-0003 risk; PH-8); the e2e profile is still outside CI.

Limitations / reuse boundary: valid for this tree. Changes to `packages/shared/src`, `apps/api/src/**`, `apps/api/drizzle/**` or the Vitest configs require rerunning claims 1–5; a schema change requires regenerating the migration.

## Final gate run
`npm run verify`, 2026-09-14 00:17 UTC, on the completed PH-1.2 tree: `check-context: 14 documents, 125 links (2 gitignored skipped), 8 phases, 5 subphases, active: PH-1 — OK`; build:shared exit 0; lint exit 0; typecheck exit 0; Vitest shared 7/7, api 15/15, web 1/1; overall exit 0.

## CI
Pending push.
