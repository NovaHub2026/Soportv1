# Release runbook
Type: RUNBOOK
Scope: how a release candidate is verified, authorized and released (`GOVERNANCE.md` §9.2–9.3, §1.1); PH-8.3
Verified on: 2026-09-14 (checklist authored; no release has been prepared or executed — none is authorized)

## Authorization first
A production release is an Owner decision (`GOVERNANCE.md` §1.1, `CLAUDE.md` bindings). The Development Agent prepares the candidate, the evidence and this checklist; it does not deploy to production, register a domain, buy hosting or choose a paid provider. Record the authorization (who, when, which commit, which environment, conditions) in `docs/evidence/RELEASE-<date>.md` before step 4.

## Gate for a release candidate
| # | Check | Where |
|---|---|---|
| 1 | No open Cycle Audit and no open MATERIAL finding; audit ledger current | `docs/audits/`, `docs/phases/ROADMAP.md` |
| 2 | CI green on the candidate commit — both jobs (`verify` + build, `api suites on PostgreSQL 16`) | `gh run list --commit <sha>` |
| 3 | `npm run verify:full` and the browser smoke on the candidate, recorded | phase evidence under `docs/evidence/` |
| 4 | Blocking backlog items closed: BL-012 (hardening), BL-019 (PostgreSQL) — done in PH-8; BL-001 (identity provider) — **open: no real Orbit identity exists**, so the candidate can only run as a labeled demo | `docs/BACKLOG.md` |
| 5 | Operating policies decided by the Owner/Operations (BL-002): hours and staffing, response targets, roles/specialist contacts, recovery procedure, retention/exports/complaints, notification channel | `OPERATIONS.md` |
| 6 | Configuration reviewed against `.env.example`: `NODE_ENV=production`, `SUPPORT_BIND`, `SUPPORT_DATABASE_URL`, `WEB_ORIGIN`, no simulated switch on a public deployment | `DEPLOYMENT.md` |
| 7 | Backup taken and restore rehearsed on a copy; rollback image tag known | `DEPLOYMENT.md` |
| 8 | Release notes: phases and decisions since the previous release, migrations included (`apps/api/drizzle/`) | `docs/evidence/RELEASE-<date>.md` |

## Release steps (once authorized)
1. Tag the verified candidate (`git tag -a vX.Y -m "…"`; never move a tag — a wrong release is superseded by a new record, §9.3).
2. Build the images from the tag; `docker compose up -d --build`; watch `/api/health` and the API log for the migration and job start lines.
3. Post-release checks: open a case from the customer host and answer it from the workspace (§14 item 2); confirm the notification and the outbox; confirm `database: postgres (server)`.
4. Record the outcome in the release record; on failure roll back (previous tag) and record that too.

## What this repository cannot promise
The product today is a complete, verified simulation of the support service (identity, records and e-mail delivery are labeled stand-ins). Releasing it to real customers requires Orbit's identity and records adapters (BL-001) and the operating policies (BL-002). Until then the honest release is an internal, access-restricted demo.
