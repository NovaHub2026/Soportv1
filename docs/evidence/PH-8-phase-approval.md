# PH-8 — Phase approval evidence
Type: VERIFICATION EVIDENCE
Work item: PH-8 — Production readiness (phase-level acceptance, `GOVERNANCE.md` §6.3)
Recorded on: 2026-09-14
Revision: the PH-8.2 commit plus the PH-8.3 working tree (the PH-8.3 commit on `main` is the phase candidate).
Environment: as in `PH-4.1-verification.md`.

## Phase scenarios (from `docs/phases/PH-8.md`) and evidence
| # | Scenario | Evidence | Category |
|---|---|---|---|
| a | Ninth concurrent stream → 429 and a released slot reusable; 31st upload in 10 min → 429; security headers and no `X-Powered-By`; `GET /nope` → JSON 404 | `PH-8.1-verification.md`: stream-cap and limiter unit specs, e2e hardening test; smoke unchanged under the controls | EXECUTED + OBSERVED |
| b | api unit and e2e suites against PostgreSQL 16 in Docker and in CI | `PH-8.2-verification.md`: driver, `test:pg`, CI job `api suites on PostgreSQL 16` — run 34827035399 **failure — the two e2e files raced on the migrator of the shared database (`CREATE SCHEMA drizzle` duplicate); fixed in the PH-8.3 commit: e2e files run sequentially and each empties its tables first** on `c09c569`; the local Docker run was not executed (engine unreachable) | EXECUTED in CI |
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
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review). Ledger: cycle 3 → 2/3.
