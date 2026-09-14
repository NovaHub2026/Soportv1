# PH-8.3 — Deployment, runbooks and phase closure
Type: SUBPHASE TECHNICAL PLAN
Status: ACTIVE
Parent: `PH-8.md`
Feature context: cross-cutting (`../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-NOTIFY/CONTEXT.md`, `../features/FEAT-ACCESS/CONTEXT.md`)

## Objective, prerequisites and scope
The product can be deployed and operated from written instructions: containers for the API and the web, a compose file with PostgreSQL, an environment reference, a rehearsal on this machine, and the release and operations runbooks that state the gate, the Owner's authorization step, backups, rollback and every operating decision still pending (`PROJECT_CONTEXT.md` §13.2, BL-002). Prerequisite: PH-8.2. Out of scope: hosting, domain, TLS, secrets management and a mail provider (Owner decisions — §1.1), executing a release.

## Affected boundaries and implementation approach
- `docker/api.Dockerfile`, `docker/web.Dockerfile` (multi-stage builds from the workspace), `docker/compose.yml` (postgres + api + web with healthchecks; the API bound to `0.0.0.0` inside its network with `NODE_ENV=production` and `SUPPORT_ALLOW_SIMULATED_IDENTITY=true` marked as the demo switch), `.env.example` and `docs/runbooks/DEPLOYMENT.md` (every variable, ports, volumes, backup/restore of PostgreSQL, upgrade = migrate on start).
- `docs/runbooks/RELEASE.md`: release gate checklist (audit status, CI both jobs green, `verify:full`, smoke, `test:pg`, BL-012/BL-019 done, no open MATERIAL finding), the Owner authorization record, tagging, rollback and post-release checks (§9.3).
- `docs/runbooks/OPERATIONS.md`: the §13.2 decisions as a table with owner and effect (staffing/hours, targets, roles/specialists, recovery procedure, retention/exports/complaints, notification channel), what the product does today as a working default, and the daily checks (queue oversight, health, backups).
- Rehearsal: build both images, `docker compose up`, `/api/health` → `postgres (server)`, the browser smoke pointed at the containers where its fixed ports allow, otherwise a scripted HTTP walk; recorded with commands and outputs.

## Required behavior, failures and acceptance evidence
- A fresh `docker compose up` reaches a healthy API and web with the schema migrated; stopping and starting keeps the data (volume).
- The runbooks contain no invented policy: each §13.2 item is marked as a pending Owner/Operations decision.
Acceptance evidence: `../evidence/PH-8.3-verification.md`; phase approval `../evidence/PH-8-phase-approval.md`.

## Work performed and important decisions
- `docker/api.Dockerfile`, `docker/web.Dockerfile` (multi-stage, `node:24-alpine`, production dependencies only, non-root, healthchecks), `docker/compose.yml` (postgres + api + web, volumes, the demo switch `SUPPORT_ALLOW_SIMULATED_IDENTITY` marked), `.dockerignore`, `.env.example` (every variable the code reads, with defaults and the decision each one carries).
- `docs/runbooks/DEPLOYMENT.md`, `RELEASE.md`, `OPERATIONS.md` as planned; `CONTEXT_INDEX.md` routes them.
- DEC-0033: the deployment shape (one API instance, PostgreSQL server, web in front with the `/api` rewrite, published web port only) and the rule that a public deployment never carries the simulated switch.

## Verification, limitations and context updates
Evidence: `../evidence/PH-8.3-verification.md`, `../evidence/PH-8-phase-approval.md`. Limitation: the compose rehearsal did not run on this host (no Docker engine) — it is the outstanding check in `RELEASE.md` and in the handoff.
Context updated: `PH-8.md` (APPROVED), `ROADMAP.md` (ledger cycle 3 → 2/3), `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `CLAUDE.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`, `../runbooks/VERIFICATION.md`.
Approved on 2026-09-14 by the Agent and **withdrawn** the same day by the cycle 3 out-of-band audit (FND-0062): the compose rehearsal is part of this subphase and has not run. Done when `docker compose -f docker/compose.yml up -d --build` succeeds on a host with a Docker engine and is recorded in `../evidence/PH-8.3-verification.md` (the Dockerfiles were corrected by the audit, FND-0058).
