# Deployment runbook
Type: RUNBOOK
Scope: `docker/api.Dockerfile`, `docker/web.Dockerfile`, `docker/compose.yml`, `.env.example`; the API's environment (`apps/api/src/main.ts`, `apps/api/src/database/database.ts`, jobs) and the web's `API_ORIGIN` rewrite
Verified on: 2026-09-14 (PH-8.3 — see `../evidence/PH-8.3-verification.md` for what was rehearsed and where)

## What a deployment is made of
| Component | Image / service | Listens | State |
|---|---|---|---|
| PostgreSQL 16 | `postgres:16-alpine` | 5432 (internal) | volume `postgres-data` — the only durable state besides uploads |
| API (NestJS) | `docker/api.Dockerfile` → `node apps/api/dist/main.js` | 3001 (internal; `SUPPORT_BIND=0.0.0.0`) | volume `uploads` (`SUPPORT_UPLOADS_DIR=/data/uploads`); runs the three background jobs — exactly ONE instance (in-process event bus and in-memory limits, ADR-0004, DEC-0031) |
| Web (Next.js) | `docker/web.Dockerfile` → `next start` | 3000 (published) | none; `/api/*` is rewritten to `API_ORIGIN` |

The browser only ever talks to the web origin. TLS termination, the public domain and any proxy in front of port 3000 are the hosting decisions of the Owner (§1.1) and are not described here.

## First start
1. `cp .env.example .env`; set `POSTGRES_PASSWORD` (required) and `WEB_ORIGIN` (the public web origin). Keep `SUPPORT_ALLOW_SIMULATED_IDENTITY=true` ONLY for an isolated demo: it makes the API trust `x-simulated-*` headers (DEC-0008, BL-001). A real deployment needs a real identity provider first — none exists today, so a production release is not possible yet (see `RELEASE.md`).
2. `docker compose -f docker/compose.yml up -d --build` — the API applies the committed migrations on start (`apps/api/drizzle/`), so an upgrade is "pull, build, up".
3. Check: `curl -s http://localhost:3000/api/health` → `{"status":"ok","database":"postgres (server)","identity":"simulated","orbitRecords":"simulated",…}`. `database` must say `postgres (server)`; `identity: simulated` is the honest label of the demo switch.
4. Open `http://localhost:3000` (customer host, labeled Simulação) and `http://localhost:3000/staff`.

## Configuration reference
Every variable with its default is listed in `.env.example`. Rules that matter in a deployment:
- `NODE_ENV=production` + `SUPPORT_BIND=0.0.0.0` together; the API warns loudly if bound to a network without production mode (DEC-0031).
- `SUPPORT_DATABASE_URL` set → PostgreSQL; unset → PGlite files in `SUPPORT_DB_DIR` (fine for a single-host demo, not for a deployment: no concurrent access, no backups tooling).
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

## Known limits of this shape
- One API instance (event bus, limits and jobs are in-process). Scaling out needs a shared channel and a shared limit store — a later decision.
- No mail provider: the e-mail channel writes the labeled outbox only (DEC-0025); choosing a provider is a paid-service decision of the Owner.
- The simulated identity/records adapters are development stand-ins (DEC-0003); a public deployment with them would let anyone claim any identity — hence the refusal in production mode without the explicit switch.
