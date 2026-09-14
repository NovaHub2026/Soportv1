# PH-8.3 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-8.3 — Deployment, runbooks and phase closure
Recorded on: 2026-09-14
Revision: base `c09c569` plus the PH-8.3 working tree, committed as the next commit on `main` (this record travels with it — §3.4; it is also the PH-8 phase candidate).
Environment: as in `PH-4.1-verification.md`; Docker Desktop 29.7.2 installed, engine not reachable (see "Rehearsal").

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | The deployment shape is written: two multi-stage Dockerfiles built from the npm workspace, a compose file with PostgreSQL + API + web (healthchecks, volumes, the demo switch marked), `.dockerignore`, `.env.example` listing every environment variable the code reads | EXECUTED (authored and cross-checked against `grep process.env` and the env helpers) | `docker/`, `.env.example` | complete — 21 variables |
| 2 | The runbooks exist and invent no policy: `DEPLOYMENT.md` (components, first start, configuration rules, backup/restore, upgrade/rollback, health, limits), `RELEASE.md` (authorization first, an 8-point gate, steps, what cannot be promised), `OPERATIONS.md` (every §13.2 decision as pending with its owner and today's working default, daily operation, staff prohibitions) | EXECUTED (authored; `check-context` validates every path they name) | `docs/runbooks/` | complete |
| 3 | Rehearsal: `docker compose -f docker/compose.yml up -d --build` on this host → healthy PostgreSQL, API (`database: postgres (server)`) and web; data survives a restart; web published on 127.0.0.1 only, API not published | EXECUTED on retry (2026-09-14, Docker Engine 29.8.0), on `a863593` — the first attempt could not run (engine blocked) | see "Rehearsal" | passed |
| 4 | Every earlier suite unchanged on the phase candidate; context documents consistent | EXECUTED | `npm run gate` | see "Final gate run" |
| 5 | CI on the pushed commit (both jobs) | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: the container images themselves (no engine on this host); the CI does not build images (a later decision when hosting exists). The compose file and Dockerfiles follow the workspace layout exactly (`apps/api/dist/main.js`, `apps/api/drizzle`, `packages/shared/dist`, `apps/web/.next`) and use the same commands the smoke uses to start both servers.

## Rehearsal
First attempt (PH-8.3, 2026-09-14): not executed — Docker Desktop's engine was blocked on this host (stale sockets needing elevation, `RELEASE-2026-09-14.md` "Blocked"); the Dockerfiles were then also found not to build (cycle 3 out-of-band audit, FND-0058, fixed in `e75b153`).

Retry (2026-09-14, after the Owner's «Reintenta», engine 29.8.0) on `a863593`, project `orbit-rehearsal`, scratch env file (random database password, `WEB_PORT=3180`, `SUPPORT_ALLOW_SIMULATED_IDENTITY=true` for this loopback demo):
- `docker compose -f docker/compose.yml --env-file <scratch>/rehearsal.env -p orbit-rehearsal config --quiet` → valid; `… up -d --build` → exit 0 in 6 min 57 s (both images built from scratch); services: postgres healthy first (the API waits for it), then api and web healthy within seconds of the checks starting.
- Published ports: web `127.0.0.1:3180->3000`; api `3001/tcp` and postgres `5432/tcp` on the compose network only. The API has no published port; the web is bound to 127.0.0.1 (a connection to the host's LAN address 100.108.123.69 (the host's first non-loopback IPv4):3180 was refused/timed out).
- HTTP checks through the web (`scratch check.mjs`, first run): `/api/health` → `postgres (server)`, identity `simulated`; web home 200, server render identity-neutral true; `/api/nope` JSON 404 true; security headers `x-content-type-options: nosniff`, `x-powered-by` absent; case `SUP-000001` created (201), staff reply 201 by "Ana Ribeiro", `staff_reply` notification true, another customer 404 true, recovery request `REC-000001`.
- Restart: `docker compose … restart` of all three services → api and web healthy again after 15 s; after it the same checks found `SUP-000001` with the staff reply persisted (true) — the `postgres-data` volume holds the state.
- API log: the non-loopback bind warning on each start (expected inside compose, DEC-0034 a) and, during the restart, `PostgreSQL pool: idle client error — terminating connection due to administrator command` twice — caught by the pool error handler added by the out-of-band audit (FND-0067) instead of crashing the process.
- Cleanup: `docker compose … down -v` (containers, network and the rehearsal volumes removed; images kept).

## Final gate run
`npm run verify` exit 0 at commit time through `scripts/gate-commit.sh` (check-context OK — ledger cycle 3 at 2/3; lint/typecheck exit 0; Vitest shared 21/21, api 65/65, web 73/73, api e2e 34/34).

## CI
Commit `22cdb72`: run 34827685994 — job `verify` + build **success**, job `api suites on PostgreSQL 16` **success** (BL-019 verified under a real pool: the unit and e2e suites, incl. concurrent takes, concurrent retries and overlapping closures, pass on PostgreSQL 16). Previous commit `c09c569` (PH-8.2): run 34827035399 — job `verify` + build **success**, job `api suites on PostgreSQL 16` **failure** (the e2e files raced on the migrator; the harness was changed here and the root cause — no migration lock — was fixed by the cycle 3 out-of-band audit, FND-0066).
