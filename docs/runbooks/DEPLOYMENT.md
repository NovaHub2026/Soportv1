# Deployment runbook
Type: RUNBOOK
Scope: `docker/api.Dockerfile`, `docker/web.Dockerfile`, `docker/compose.yml`, `.env.example`; the API's environment (`apps/api/src/main.ts`, `apps/api/src/database/database.ts`, jobs) and the web's `API_ORIGIN` rewrite
Verified on: 2026-09-14 — compose rehearsal executed on `a863593` (`../evidence/PH-8.3-verification.md` "Rehearsal")

## What a deployment is made of
| Component | Image / service | Listens | State |
|---|---|---|---|
| PostgreSQL 16 | `postgres:16-alpine` | 5432 (internal) | volume `postgres-data` — the only durable state besides uploads |
| API (NestJS) | `docker/api.Dockerfile` → `node apps/api/dist/main.js` | 3001 (internal; `SUPPORT_BIND=0.0.0.0`) | volume `uploads` (`SUPPORT_UPLOADS_DIR=/data/uploads`); runs the three background jobs — exactly ONE instance (in-process event bus and in-memory limits, ADR-0004, DEC-0031) |
| Web (Next.js) | `docker/web.Dockerfile` → `next start` | 3000 (published on 127.0.0.1 only) | none; `/api/*` is rewritten to `API_ORIGIN`, fixed at BUILD time (build argument, compose passes `http://api:3001`) |

The browser only ever talks to the web origin. TLS termination, the public domain and any proxy in front of port 3000 are the hosting decisions of the Owner (§1.1) and are not described here.

## First start
1. `cp .env.example .env`; set `POSTGRES_PASSWORD` (required — compose refuses an empty value) and `WEB_ORIGIN`. `SUPPORT_ALLOW_SIMULATED_IDENTITY` defaults to `false`, so the API refuses to start in production mode: set it to `true` only for a demo on this machine — it makes the API trust `x-simulated-*` headers (DEC-0008, BL-001). The web is published on 127.0.0.1 only and the API is not published (DEC-0034 a). A real deployment needs a real identity provider first — none exists today, so a production release is not possible yet (see `RELEASE.md`).
2. `docker compose -f docker/compose.yml up -d --build` — the API applies the committed migrations on start (`apps/api/drizzle/`), so an upgrade is "pull, build, up".
3. Check: `curl -s http://localhost:3000/api/health` → `{"status":"ok","database":"postgres (server)","identity":"simulated","orbitRecords":"simulated","staffDirectory":"simulated",…}`. `database` must say `postgres (server)`; `identity: simulated` is the honest label of the demo switch.
4. Open `http://localhost:3000` (customer host, labeled Simulação) and `http://localhost:3000/staff`.

## Configuration reference
Every variable with its default is listed in `.env.example`. Rules that matter in a deployment:
- `NODE_ENV=production` + `SUPPORT_BIND=0.0.0.0` together; the API warns loudly if bound to a network without production mode (DEC-0031).
- `SUPPORT_DATABASE_URL` set → PostgreSQL; unset → PGlite files in `SUPPORT_DB_DIR` (fine for a single-host demo, not for a deployment: no concurrent access, no backups tooling).
- `SUPPORT_TRUST_PROXY` = the number of reverse proxies that append `X-Forwarded-For` in front of the web (usually `1`, the TLS proxy). Leave it unset in the loopback/compose topology: the web's proxy does not report the browser's address and passes a forged header through (observed in PH-9.4), so no address identifies a client there and the recovery route's per-client limit stays off (the per-contact limit and the instance ceiling still apply). Set it with the TLS proxy of any deployment reachable beyond loopback (BL-026, DEC-0038).
- Jobs: one API instance only. Intervals are integers between 1 and 2 147 483 647 ms; `off` disables a job (FND-0031).
- Limits per instance: 8 open streams and 30 uploads per 10 minutes per identity (DEC-0031); attachments 10 MB, PNG/JPEG/WebP/PDF (DEC-0009).

## Backups and restore
- Database: `docker compose -f docker/compose.yml exec postgres pg_dump -U orbit -Fc orbit_support > backup-$(date +%F).dump`; restore into an empty database with `pg_restore -U orbit -d orbit_support backup.dump` (stop the API first; start it afterwards — migrations are idempotent).
- Uploads: the `uploads` volume (`docker run --rm -v soportv1_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads-$(date +%F).tgz -C /data .`).
- Retention of both is an operating policy the Owner/Operations must set (`OPERATIONS.md`, BL-002); nothing is deleted automatically today.

## Upgrade and rollback
- Upgrade: `git pull`, `docker compose -f docker/compose.yml up -d --build`. Migrations run forward on start; they are never run backwards. A migration that adds an enum value cannot use it in the same run (runbook note in `VERIFICATION.md`).
- Rollback: redeploy the previous image tag. Because migrations only add columns/tables so far, the previous API version runs against the newer schema; verify that on the release candidate before relying on it (`RELEASE.md`).

## Health and logs
- `GET /api/health` — liveness plus the honest labels (driver, identity, records adapter).
- `docker compose -f docker/compose.yml logs -f api` — job activity ("E-mailed n notification(s)", "Sent n reminder(s)"), env warnings, refused starts (production without the simulated-identity switch).
- The web has no server state; restart it freely.

## Single-host demo without containers
When no Docker engine is available, `npm run build` then `node scripts/demo-local.mjs` starts the same two servers on loopback with PGlite (`apps/api/.data/demo`); `--check` verifies health, headers, a case round-trip, the notification and customer isolation, then stops. Used for the internal demo `v0.1.0-demo` (`../evidence/RELEASE-2026-09-14.md`).

## Safe defaults (cycle 3 out-of-band audit, DEC-0034 a)
- Nothing is reachable from another machine unless you change `docker/compose.yml`'s `127.0.0.1:` port binding — and with the simulated identity you must not.
- The API announces every non-loopback bind; inside compose it binds `0.0.0.0` on the private network only.
- Before this audit the files would not have worked: the web image copied a public directory that does not exist and read `API_ORIGIN` too late (FND-0058). They were built and rehearsed on this host on 2026-09-14 (`../evidence/PH-8.3-verification.md` "Rehearsal").

## Known limits of this shape
- One API instance (event bus, limits and jobs are in-process). Scaling out needs a shared channel and a shared limit store — a later decision.
- No mail provider: the e-mail channel writes the labeled outbox only (DEC-0025); choosing a provider is a paid-service decision of the Owner.
- The simulated identity/records adapters are development stand-ins (DEC-0003); a public deployment with them would let anyone claim any identity — hence the refusal in production mode without the explicit switch.

## Orbit adapters (PH-13, DEC-0045)
The API talks to the broker only when an adapter is set to `optaqode` (`SUPPORT_IDENTITY_PROVIDER`, `SUPPORT_ORBIT_RECORDS`, `SUPPORT_STAFF_DIRECTORY` — the directory follows the records adapter by default); `simulated` remains the default and the demo's setting. With `optaqode` the API refuses to start unless `ORBIT_API_BASE_URL` (https) is set, plus `ORBIT_SERVICE_TOKEN` for records/directory and exactly one of `ORBIT_JWT_SECRET` / `ORBIT_JWT_JWKS_URL` for identity (`.env.example`). `GET /api/health` names the three adapters; a deployment that reports `simulated` anywhere is a demo (DEC-0003). Nothing is written to the broker; a broker outage shows as "indisponível" in the workspace, never as a wrong answer (RULE-SUP-07). The live connection is PH-13.3 (`../integration/ORBIT-INTEGRATION.md` §7 lists what the backend must provide).
The service account (DEC-0046 b): a read-only team member of the broker's back-office created by the Owner for Orbit Support (`auditor`, active, no 2FA); its e-mail and password go to the API as `ORBIT_SERVICE_EMAIL` / `ORBIT_SERVICE_PASSWORD` (or a static `ORBIT_SERVICE_TOKEN`); the API logs in and refreshes by itself and never stores the password. Customer tokens need no material: the API proves them with the broker (`GET /profiles/me`). The embedded panel: run the web server with `SUPPORT_EMBED_HOST_ORIGINS=<the broker's app origin>` and have the broker mount `<panel origin>/embed` with the proposed host component (`../integration/broker-host/OrbitSupportPanel.tsx`); the edge in front of the panel must allow that origin in `frame-ancestors`.

## Local integration demo (simulated broker)
`npm run build`, then `node scripts/demo-integration.mjs` starts a SIMULATED broker (`scripts/fake-broker.mjs`, 127.0.0.1:3005 — its host page mounts the embedded panel exactly as the broker's app will), the API with the real `optaqode` adapters pointed at it (`SUPPORT_IDENTITY_PROVIDER=optaqode`, `SUPPORT_SIMULATED_STAFF=true`, `SUPPORT_ORBIT_RECORDS=optaqode`, `SUPPORT_STAFF_DIRECTORY=simulated`) and the web with `SUPPORT_EMBED_HOST_ORIGINS=http://127.0.0.1:3005`; open http://127.0.0.1:3005, pick a customer, press "Suporte"; staff at http://127.0.0.1:3000/staff with the simulated picker. `--check` runs the checks and stops. Data under `apps/api/.data/demo-integration` (gitignored). Nothing here proves a connection to the real broker (DEC-0047); PH-13.4 does.
