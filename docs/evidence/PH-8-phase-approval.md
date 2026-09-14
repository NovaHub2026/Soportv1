# PH-8 — Phase approval evidence
Type: VERIFICATION EVIDENCE
**Approval withdrawn** on 2026-09-14 by the cycle 3 out-of-band audit (`../audits/CYCLE-3-OOB.md`, FND-0062): scenario (c) below was never executed and the web image could not have built. The rows are kept as history; rows (a) and (b) are corrected below.
Work item: PH-8 — Production readiness (phase-level acceptance, `GOVERNANCE.md` §6.3)
Recorded on: 2026-09-14
Revision: the PH-8.2 commit plus the PH-8.3 working tree (the PH-8.3 commit on `main` is the phase candidate).
Environment: as in `PH-4.1-verification.md`.

## Phase scenarios (from `docs/phases/PH-8.md`) and evidence
| # | Scenario | Evidence | Category |
|---|---|---|---|
| a | Ninth concurrent stream → 429 and a released slot reusable; 31st upload in 10 min → 429; security headers and no `X-Powered-By`; `GET /nope` → JSON 404 | `PH-8.1-verification.md`: stream-cap and limiter unit specs, e2e hardening test; over HTTP only later, by the cycle 3 audit reviewers and the FND-0068 e2e (corrected wording — the controls were not observed over HTTP when this row was written) | EXECUTED |
| b | api unit and e2e suites against PostgreSQL 16 in Docker and in CI | `PH-8.2-verification.md`: driver, `test:pg`; CI job `api suites on PostgreSQL 16` — run 34827035399 on `c09c569` **failure** (migrator race), run 34827685994 on `22cdb72` **success**; the local Docker run was not executed (engine unreachable). Corrected wording: the first version of this row called the failed run "EXECUTED in CI" | EXECUTED in CI (green on `22cdb72`) |
| c | `docker compose up` starts PostgreSQL, API and web; `/api/health` answers `postgres (server)`; the smoke passes against the containers | `PH-8.3-verification.md`: files authored and cross-checked; rehearsal NOT executed on this host (no engine) — recorded as a limitation, not as done | NOT VERIFIED |
| d | The release runbook lists the gate, the authorization step, configuration, backup/restore and rollback; the operations runbook lists every §13.2 decision as pending with its owner | `docs/runbooks/RELEASE.md`, `DEPLOYMENT.md`, `OPERATIONS.md` | EXECUTED (documents) |

## Phase-level checks
- Every subphase approved with its own evidence: `PH-8.1-verification.md`, `PH-8.2-verification.md` (conditional on the CI PostgreSQL job — failure — the two e2e files raced on the migrator of the shared database (`CREATE SCHEMA drizzle` duplicate); fixed in the PH-8.3 commit: e2e files run sequentially and each empties its tables first), `PH-8.3-verification.md`.
- Blocking release conditions: BL-012 done, BL-019 done (CI), BL-021 done, BL-024 partly; BL-001 and BL-002 remain open by nature (Owner/Operations) and are stated in `RELEASE.md` and `OPERATIONS.md`.
- Rules: RULE-SUP-08 (no invented policy — every pending decision is marked), §9.3 (release prepared, not executed), DEC-0008 (production start refuses the simulated identity unless explicitly allowed, and the compose file says so).

## Limitations recorded
- Scenario (c) was not rehearsed: the Docker engine on this host never became reachable; the first `docker compose up` on a host with a working engine is the outstanding check, listed in the release gate (RELEASE.md #7) and in the handoff.
- The product remains a labeled simulation for identity, records and e-mail delivery (BL-001, DEC-0003, DEC-0025); a production release is not possible until Orbit's adapters exist and the Owner authorizes it (§1.1).

Implemented and locally verified: yes (except the container rehearsal as stated). Integrated: `main` (PH-8.3 commit). CI verified: run 34827685994 on `22cdb72` — both jobs **success** (`PH-8.3-verification.md`). Released: no — not authorized, and not possible without BL-001.
Approved on 2026-09-14 by the Agent; **withdrawn** the same day (FND-0062) — ledger cycle 3 back to 1/3.

## Re-approval (2026-09-14, after the Owner's «Reintenta»)
Scenario (c) — `docker compose up` starts PostgreSQL, API and web; `/api/health` answers `postgres (server)`; the application works against the containers — **OBSERVED** on `a863593` with the Dockerfiles corrected by the out-of-band audit: see `PH-8.3-verification.md` "Rehearsal" (HTTP walk through the web: case round-trip, notification, customer isolation, recovery, JSON 404, headers, identity-neutral render; data persisted across a restart; web on 127.0.0.1 only, API unpublished). Scenario (b) now also ran locally (`PH-8.2-verification.md`). The browser smoke itself runs against its own servers on fixed ports, not against the containers; the rehearsal used a scripted HTTP walk, as the plan allowed.
Re-approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review). Ledger: cycle 3 → 2/3.
