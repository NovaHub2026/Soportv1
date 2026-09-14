# PH-8.3 — Deployment, runbooks and phase closure
Type: SUBPHASE TECHNICAL PLAN
Status: ACTIVE
Parent: `PH-8.md`
Feature context: cross-cutting (`../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-NOTIFY/CONTEXT.md`, `../features/FEAT-ACCESS/CONTEXT.md`)

## Objective, prerequisites and scope
The product can be deployed and operated from written instructions: containers for the API and the web, a compose file with PostgreSQL, an environment reference, a rehearsal on this machine, and the release and operations runbooks that state the gate, the Owner's authorization step, backups, rollback and every operating decision still pending (`PROJECT_CONTEXT.md` §13.2, BL-002). Prerequisite: PH-8.2. Out of scope: hosting, domain, TLS, secrets management and a mail provider (Owner decisions — §1.1), executing a release.

## Affected boundaries and implementation approach
- (to be created) `docker/api.Dockerfile`, `docker/web.Dockerfile` (multi-stage builds from the workspace), `docker/compose.yml` (postgres + api + web with healthchecks; the API bound to `0.0.0.0` inside its network with `NODE_ENV=production` and `SUPPORT_ALLOW_SIMULATED_IDENTITY=true` marked as the demo switch), `.env.example` and `docs/runbooks/DEPLOYMENT.md` (every variable, ports, volumes, backup/restore of PostgreSQL, upgrade = migrate on start).
- (to be created) `docs/runbooks/RELEASE.md`: release gate checklist (audit status, CI both jobs green, `verify:full`, smoke, `test:pg`, BL-012/BL-019 done, no open MATERIAL finding), the Owner authorization record, tagging, rollback and post-release checks (§9.3).
- (to be created) `docs/runbooks/OPERATIONS.md`: the §13.2 decisions as a table with owner and effect (staffing/hours, targets, roles/specialists, recovery procedure, retention/exports/complaints, notification channel), what the product does today as a working default, and the daily checks (queue oversight, health, backups).
- Rehearsal: build both images, `docker compose up`, `/api/health` → `postgres (server)`, the browser smoke pointed at the containers where its fixed ports allow, otherwise a scripted HTTP walk; recorded with commands and outputs.

## Required behavior, failures and acceptance evidence
- A fresh `docker compose up` reaches a healthy API and web with the schema migrated; stopping and starting keeps the data (volume).
- The runbooks contain no invented policy: each §13.2 item is marked as a pending Owner/Operations decision.
Acceptance evidence: `../evidence/PH-8.3-verification.md` (to be created); phase approval `../evidence/PH-8-phase-approval.md` (to be created).

## Work performed and important decisions
Pending.

## Verification, limitations and context updates
Pending.
