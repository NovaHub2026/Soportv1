# PH-8 — Production readiness
Type: PHASE CONTEXT
Status: ACTIVE
Objective / Feature IDs: all objectives; FEAT-CASE, FEAT-CHAT, FEAT-STAFF, FEAT-ORBIT, FEAT-NOTIFY, FEAT-ACCESS (cross-cutting)
Cycle: 3 (count in the `ROADMAP.md` ledger)

## Outcome and why now
The product PH-1..PH-7 delivered can be operated honestly: the hardening every audit deferred to "PH-8" is done, the concurrency rule is confirmed against a server PostgreSQL, the deployment is described and rehearsed with real containers, and the operating policies the product context leaves to the Owner/Operations (`PROJECT_CONTEXT.md` §13.2, BL-002) are laid out as decisions to take — never invented. The release itself is prepared, not executed: production release authority stays with the Owner (`GOVERNANCE.md` §1.1, §9.3). Why now: PH-7 approved; PH-8 is the last planned phase and every other phase it depends on is approved.

## Scope, non-goals and dependencies
In scope: (1) hardening and carried debt — BL-012 (per-identity SSE cap, upload rate limit, security headers, no server fingerprint, JSON 404s, loopback bind by default with an explicit deployment bind, the unset-`NODE_ENV` policy), BL-021 (waiting-for-team age and overdue), BL-024 (accessibility basics); (2) BL-019 — the api unit and e2e suites against a server PostgreSQL through a real driver, locally in Docker and in CI; (3) deployment: containers for the API and the web with a PostgreSQL service, an environment reference, a rehearsal on this machine, backups and recovery notes; (4) operations and release runbooks: the release gate checklist, rollback, health, and the operating-policy decisions the Owner/Operations must supply (staffing, hours, targets, retention, complaints, recovery procedure, notification channel) stated as open items.
Non-goals: a real Orbit integration (BL-001), a real mail provider (a port exists; choosing one is a paid-service decision — §1.1), executing a production release, hosting choices and costs (Owner), the Spanish locale.
Dependencies: PH-1..PH-7 (approved); BL-002 (Owner/Operations input — PH-8 states what is missing).

## Product rules and acceptance scenarios
- §10.2 / RULE-SUP-01: one identity cannot exhaust streams or storage; nothing about the server leaks in headers; unknown routes answer JSON, never HTML.
- DEC-0017: the lock-in-transaction rule holds under a real connection pool (BL-019).
- RULE-SUP-08: no operating promise appears in the product before Operations decides it (BL-002 items stay marked as pending decisions).
- §9.3: a release candidate is verified and authorized before any production action; PH-8 stops at "prepared".
Scenarios: (a) the ninth concurrent stream of one identity is refused with 429 and a released slot can be taken again; the 31st upload in ten minutes → 429; every response carries the security headers and no `X-Powered-By`; `GET /nope` → JSON 404; (b) `npm run test:pg -w api` runs the api unit and e2e suites against PostgreSQL 16 in Docker and CI runs them against a service container — green; (c) `docker compose up` starts PostgreSQL, the API (bound to its network, `NODE_ENV=production` with the simulated identity explicitly allowed for the rehearsal) and the web; `/api/health` answers and the browser smoke passes against the containers; (d) the release runbook lists the gate, the authorization step, the configuration, backup/restore and rollback; the operations runbook lists every §13.2 decision as pending with its owner.

## Important uncertainties and decision references
- Hosting, domain, TLS termination, secrets management and the mail provider are Owner decisions (spending, contracts — §1.1); the runbooks describe what the deployment needs from them.
- Orbit's identity and records do not exist (BL-001): a production start with the simulated identity is refused unless explicitly allowed for an isolated demo (DEC-0008); the rehearsal uses that switch and says so.

## Planned subphases, adjusted as evidence arrives
| ID | Block | Status |
|---|---|---|
| PH-8.1 | Hardening and carried debt: BL-012, BL-021, BL-024 (partial) — `PH-8.1.md`, approved 2026-09-14 | APPROVED |
| PH-8.2 | PostgreSQL verification (BL-019): `SUPPORT_DATABASE_URL` driver, `test:pg`, Docker locally, CI service container — `PH-8.2.md`, approved 2026-09-14 (conditional on the CI PostgreSQL job) | APPROVED |
| PH-8.3 | Deployment and runbooks: containers, compose rehearsal, environment reference, release and operations runbooks; phase closure — `PH-8.3.md` | ACTIVE |

## Verification and operational readiness
Per subphase: unit/e2e negatives for each hardening control, the PostgreSQL run as its own evidence, the compose rehearsal recorded with commands and outputs, the runbooks reviewed against §9.3. `npm run gate` for every commit; `npm run verify:full` and the smoke on the phase candidate.

## Completion evidence, findings and context updated
Pending — `../evidence/PH-8-phase-approval.md` (to be created) will map scenarios (a)–(d) to executed tests, the PostgreSQL run, the rehearsal and the runbooks.
