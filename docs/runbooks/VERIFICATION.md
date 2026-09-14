# Verification runbook
Type: RUNBOOK
Scope: root `package.json` scripts, `apps/web`, `apps/api`, `scripts/check-context.mjs`, `.github/workflows/ci.yml`
Verified on: 2026-09-14 (Cycle Audit 2 remediation, `docs/evidence/CYCLE-2-verification.md`)

## Setup
- Node ≥ 24 (`.nvmrc`), npm ≥ 11. Observed locally: Node v24.19.0, npm 11.17.0 (Windows 11 native since 2026-09-14; WSL2 before).
- Fresh clone: the git author is repo-local (DEC-0002) — `git config --local user.name NovaHub2026` and `git config --local user.email orbitmarket.pro@gmail.com` before committing. Enable the pre-commit hook: `git config core.hooksPath scripts/git-hooks` (runs `check:context`; BL-020).
- Committing (gate-then-commit, FND-0028/FND-0040): write the message to a file and run `npm run gate <message-file>` (= `bash scripts/gate-commit.sh <message-file> [--no-push]`): it runs `npm run verify` (output in `.gate-verify.log`, git-ignored), refuses to commit on a non-zero exit or when a `<NAME>_PLACEHOLDER` token is left in the documentation, then commits and pushes. Never chain `verify` and `git commit` by hand.
- PowerShell (the host's primary shell): env-prefixed commands become `$env:SUPPORT_DB_DIR = "C:/scratch/db"; $env:SUPPORT_UPLOADS_DIR = "C:/scratch/uploads"; node scripts/ui-smoke.mjs docs/evidence/screenshots/<dir>`; the gate script needs Git Bash (`bash scripts/gate-commit.sh …`).
- `npm ci` at the repository root. npm workspaces: `packages/*`, `apps/*`. Do not install inside an app directory.
- `@orbit-support/shared` must be built before the apps type-check or test: `npm run build:shared` (the `verify` chain does it). After editing `packages/shared/src`, rebuild.
- Database: embedded PostgreSQL (PGlite, ADR-0003). No server or Docker needed. Dev data lives in `apps/api/.data/pglite` (gitignored; delete to reset). `SUPPORT_DB_DIR` overrides the directory; unset means in memory (tests).
- Schema change: edit `apps/api/src/database/schema.ts`, run `npm run db:generate -w api`, commit the new file under `apps/api/drizzle/`. Migrations apply automatically when the API opens the database.
- Attachments (DEC-0009): files are stored under `SUPPORT_UPLOADS_DIR` (default `apps/api/.data/uploads`, gitignored); the UI smoke must point it at scratch too. Allowed: PNG, JPEG, WebP, PDF; 10 MB; 3 per message.
- Closure job (DEC-0013): the API closes resolved cases after `SUPPORT_FOLLOW_UP_WINDOW_DAYS` (default 7) every `SUPPORT_CLOSURE_INTERVAL_MS` (default 60 000); `SUPPORT_CLOSURE_JOB=off` (any case) disables it (tests). Run one API instance. Numeric env values must be integers between 1 and 2 147 483 647 (Node's timer range); anything else falls back to the default with a warning (FND-0014, FND-0031).
- Migrations run in one transaction per start (drizzle migrator): a migration that adds an enum value must not use that value in the same run (PostgreSQL and PGlite refuse it) — add the value in one migration and use it in the next (Cycle Audit 2, ARC-9).
- Test determinism: the api unit and e2e setups save an always-open schedule (00:00–23:59 every day) so the outside-hours notice never depends on the wall clock; the minute 23:59 local is the one closed minute (a known ≈0.07 % window, FND-0051) — rerun if a suite fails exactly then.
- Dependency overrides: `multer` is pinned to 2.3.0 through root `overrides` (FND-0020); `npm audit --omit=dev` must stay at 0 before a release.
- Roles (DEC-0029, PH-7.2): staff resolve only from the simulated directory (`SIMULATED_STAFF_DIRECTORY`: ana and bruno agents, carla supervisor); `x-simulated-staff-role` cannot promote anyone — the directory's role wins. Agents get 403 `not_case_owner` on state changes of a colleague's case.
- Identity (DEC-0008): `SUPPORT_IDENTITY_PROVIDER=simulated` is the only provider; with `NODE_ENV=production` the API refuses to start unless `SUPPORT_ALLOW_SIMULATED_IDENTITY=true` is set deliberately for an isolated demo. `GET /api/identity/me` shows who the API thinks you are.
- Reminders and outside hours (PH-6.3, DEC-0027): `SUPPORT_REMINDER_JOB=off` disables the reminder job, `SUPPORT_REMINDER_INTERVAL_MS` sets its cadence (default 60 000); the wait is measured from `waiting_customer_since` (migration `0015`); the outside-hours notice follows the configured schedule (close every day in the supervision settings to see it). The time zone must be one `Intl` knows (400 `invalid_timezone` otherwise).
- Notifications (PH-6): `GET /api/support/notifications`, `POST …/read`; `GET/PUT /api/support/preferences`; `GET /api/support/emails` (the simulated outbox — no real e-mail is ever sent; `SUPPORT_NOTIFICATION_JOB=off` disables the delay job, `SUPPORT_NOTIFICATION_INTERVAL_MS` sets its cadence, default 60 000).
- Configuration and supervision (PH-5.4): `GET/PUT /api/staff/settings` (PUT needs supervisor/admin), `GET /api/staff/overview`, `GET /api/staff/metrics?days=7|30` (supervisor/admin), `GET /api/support/availability` (customer). Without a saved row the working defaults apply (weekdays 09:00–18:00 America/Sao_Paulo, 4 h attention threshold, 7-day window) and the customer copy says so.
- Saved replies (PH-5.3): `GET/POST /api/staff/saved-replies`, `PATCH/DELETE /api/staff/saved-replies/<id>` (staff; edits of others' replies need `x-simulated-staff-role: supervisor` or `admin`).
- Access recovery (DEC-0028, PH-7.1): `POST /api/public/access-recovery` needs no identity (`{ contact, description, clientRequestId? }` → `REC-…` receipt; 429 after 3 per contact per hour or 30 per instance per 10 minutes); staff: `GET /api/staff/access-recovery?status=received|forwarded|closed`, `POST /api/staff/access-recovery/<id>/handle { outcome: forwarded|closed, note? }`. The hand-off to Orbit is simulated (labeled).
- Orbit records (DEC-0019, PH-4): `SUPPORT_ORBIT_RECORDS=simulated` is the only adapter; `SUPPORT_SIMULATED_ORBIT=unavailable` makes every lookup answer "unavailable" to exercise that experience. `GET /api/staff/cases/<id>/orbit` returns the customer's masked summary and the linked record's current state, or the unavailable state; `GET /api/support/records` lists the customer's own simulated records for contextual entry (PH-4.2); `/api/health` reports `orbitRecords`.

## Profiles (`GOVERNANCE.md` §7.2–7.3)
| Profile | Command | Layers | Use when |
|---|---|---|---|
| context | `npm run check:context` | Link and lifecycle consistency of live context documents | Any documentation or state change; approval-only edits |
| static | `npm run lint && npm run typecheck` | ESLint (web), oxlint (api); `tsc --noEmit` in both apps (web runs `next typegen` first) | Any code change |
| unit | `npm test` | Vitest in `packages/shared`, `apps/web` (jsdom + Testing Library) and `apps/api` (in-memory PGlite) | Behavior change |
| api e2e | `npm run test:e2e` | Vitest + supertest against the Nest application (HTTP contracts, guards, multer, SSE) | API contract change; part of `verify` since Cycle Audit 1 |
| verify | `npm run verify` | context + build:shared + static + unit + api e2e, in that order | Before every commit; required CI check |
| full | `npm run verify:full` | verify + production builds (`next build`, `nest build`) | Phase candidate or release candidate (CI runs the builds on every push since Cycle Audit 2) |
| gate | `npm run gate <message-file>` | verify → PLACEHOLDER check → commit → push (`scripts/gate-commit.sh`) | Every commit |
| ui smoke | `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch2> node scripts/ui-smoke.mjs [outDir]` after `npm run build` (both variables required; the script refuses to run without them) | Headless Chromium (Playwright) drives the built customer panel and staff workspace end to end and saves screenshots; the last phase restarts the API in Orbit outage mode (PH-4.3) | UI subphase/phase approval (OBSERVED evidence, §6.3); not in CI |

UI smoke prerequisites: `npx playwright install chromium` (downloads ~115 MB). On Windows nothing else is needed. On Linux/WSL2 Chromium also needs system libraries; with sudo run `npx playwright install-deps chromium`. Without sudo (the Owner's WSL2, BL-007): `apt-get download libnspr4 libnss3 libasound2t64`, `dpkg -x` each into a scratch folder and export `LD_LIBRARY_PATH=<scratch>/usr/lib/x86_64-linux-gnu` before running the smoke. The smoke uses API port 3001 (baked into the web build's rewrites) and web port 3150 (`UI_WEB_PORT`). Always point `SUPPORT_DB_DIR` at a scratch directory.

On a fresh checkout the first PGlite start compiles WASM and can take tens of seconds; the api vitest configs set `hookTimeout: 60_000` for that (FND-0019). Exit codes propagate: the `verify` chain stops at the first failing layer. Vitest exits non-zero when it discovers no test files, so an empty suite cannot pass as green. The report of any run must name the profile that ran; a targeted pass is not a full-project pass.

## Running the applications
| App | Command | URL |
|---|---|---|
| API (NestJS) | `npm run dev:api` | http://localhost:3001/api/health (`PORT` overrides; CORS allows `WEB_ORIGIN`, default http://localhost:3000) |
| Web (Next.js) | `npm run dev:web` | http://localhost:3000 — simulated Orbit shell with the customer "Suporte" panel; http://localhost:3000/staff — staff workspace. The browser calls `/api/*`, rewritten to `API_ORIGIN` (default http://localhost:3001) |

Live updates (ADR-0004): `GET /api/support/cases/stream` (customer, all own cases), `GET /api/support/cases/<id>/stream` (customer, one case) and `GET /api/staff/cases/stream` (staff) are Server-Sent Events; try `curl -N -H 'x-simulated-staff-id: staff-ana' http://localhost:3001/api/staff/cases/stream`. Heartbeat every 15 s (`SUPPORT_SSE_HEARTBEAT_MS`). The event bus is in-process: run one API instance until PH-8 adds a shared channel.

Simulated identity (DEC-0003): the API resolves the caller from headers `x-simulated-customer-id`, or `x-simulated-staff-id` (+ optional `x-simulated-staff-role`, `x-simulated-staff-name`). Example: `curl -H 'x-simulated-customer-id: cust-1' http://localhost:3001/api/support/cases`.

`next dev` regenerates `apps/web/AGENTS.md`; commit that change with your work if it appears.

## CI
`.github/workflows/ci.yml` runs `npm ci && npm run verify && npm run build` on every push to `main` and on pull requests (builds added by Cycle Audit 2, FND-0052). CI runs after integration to `main`, so a push is "awaiting corroboration" until the run completes (§9.2). Check with `gh run list --limit 3` / `gh run view <id>`; record the verdict per candidate in evidence.

## Limitations
- No browser/e2e tests, no coverage threshold, no performance checks.
- `check-context` is mechanical; see the script header for what it does not establish.
- Builds are not part of the local `verify` (kept in `full`) to keep the per-commit gate fast; CI runs them on every push; run `full` before approving a phase.
- The UI smoke is not in CI (DEC-0027 e; BL-008 revisited at PH-8).
- Concurrency is verified on PGlite (one serialized connection); the row-lock rule (DEC-0017) is confirmed against a server PostgreSQL only in PH-8 (BL-019).
