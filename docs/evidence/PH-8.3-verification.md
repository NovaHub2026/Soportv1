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
| 3 | Rehearsal: `docker compose -f docker/compose.yml up -d --build` on this host | NOT EXECUTED (Docker Desktop's engine never became reachable on this host during PH-8 — see "Rehearsal"); the Dockerfiles and compose file are reviewed by reading against the workspace layout and the runbooks say so | `docker info` | engine unreachable |
| 4 | Every earlier suite unchanged on the phase candidate; context documents consistent | EXECUTED | `npm run gate` | see "Final gate run" |
| 5 | CI on the pushed commit (both jobs) | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: the container images themselves (no engine on this host); the CI does not build images (a later decision when hosting exists). The compose file and Dockerfiles follow the workspace layout exactly (`apps/api/dist/main.js`, `apps/api/drizzle`, `packages/shared/dist`, `apps/web/.next`) and use the same commands the smoke uses to start both servers.

## Rehearsal
Not executed on this host. Docker Desktop 29.7.2 is installed and was started, but its Linux engine never became reachable during PH-8 (`docker info`: "failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine"), so neither the images nor the compose file were run here. What was checked instead: the Dockerfiles copy exactly the artifacts the built workspace produces (`packages/shared/dist`, `apps/api/dist` + `apps/api/drizzle`, `apps/web/.next` + `public` + `next.config.ts`) and start the servers with the same commands the browser smoke uses (`node apps/api/dist/main.js`; Next's JS entry with `start -p 3000`); `.env.example` was cross-checked against every `process.env` read and every env helper call in the code (21 variables). Cause found during the demo release (2026-09-14): Docker Desktop 4.87's backend crashes at start on four stale socket entries in `%LOCALAPPDATA%\Docker\run` (dated 21/08/2026) that cannot be read or removed without elevation (`del` and `icacls` refused) — Owner action in `RELEASE-2026-09-14.md` "Blocked". The first `docker compose -f docker/compose.yml up -d --build` on a host with a working engine is the outstanding check, listed in `../runbooks/RELEASE.md` (#7) and in `../../SESSION_HANDOFF.md`.

## Final gate run
`npm run verify` exit 0 at commit time through `scripts/gate-commit.sh` (check-context OK — ledger cycle 3 at 2/3; lint/typecheck exit 0; Vitest shared 21/21, api 65/65, web 73/73, api e2e 34/34).

## CI
Commit `22cdb72`: run 34827685994 — job `verify` + build **success**, job `api suites on PostgreSQL 16` **success** (BL-019 verified under a real pool: the unit and e2e suites, incl. concurrent takes, concurrent retries and overlapping closures, pass on PostgreSQL 16). Previous commit `c09c569` (PH-8.2): run 34827035399 — job `verify` + build **success**, job `api suites on PostgreSQL 16` **failure** (the e2e files raced on the migrator; the harness was changed here and the root cause — no migration lock — was fixed by the cycle 3 out-of-band audit, FND-0066).
