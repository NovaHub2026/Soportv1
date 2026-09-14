# PH-9 — Release-candidate debt
Type: PHASE CONTEXT
Status: APPROVED
Objective / Feature IDs: OBJ-SUP-03, OBJ-SUP-04; FEAT-CASE, FEAT-STAFF, FEAT-CHAT, FEAT-NOTIFY, FEAT-ACCESS (cross-cutting)
Cycle: 3 (count in the `ROADMAP.md` ledger)

## Outcome and why now
The Agent-owned debt that the audits carried past PH-8 is paid, so the next release candidate beyond the internal demo does not start with known product gaps, duplicated rules or a fragile harness. Four backlog items name "the next release candidate beyond the demo" as their blocking condition (BL-022, BL-023, BL-024, BL-029) and one blocks any deployment reachable beyond loopback (BL-026).
Why now: the Owner asked to continue with the pending phases («continua con las siguientes fases pendientes», 2026-09-14). Every capability of the initial scope is approved; what remains toward production is either an Owner decision (BL-001, BL-002, hosting, a mail provider) or this debt — the only part the Agent can move alone.

## Scope, non-goals and dependencies
In scope: (1) case domain — BL-022 (one owner per case rule, reminders decided under the case lock, tests of the jobs' `tick()` paths), BL-029 (open consultations count as waiting for a team), BL-013 API part (idempotent internal notes), BL-018 (shared response schemas checked by the e2e suite); (2) staff workspace — BL-014 (one action helper, `StaffCaseView.tsx` split), BL-013 web part (note retry key, composer chips kept until the send succeeds, attachments on pending/failed rows), BL-024 carried items (queue tab semantics, raw number fields in the settings form, system-message copy through the dictionary); (3) customer panel — BL-010 (attachments on the first message), BL-015 (desktop close controls); (4) operations and process — BL-009 (orphan attachment cleanup), BL-026 (`Retry-After` on every 429, a proxy-aware per-client limit for the recovery route), BL-023 (smoke isolation), BL-030 (checker blind spots); phase closure.
Non-goals: everything that needs the Owner — Orbit adapters (BL-001), operating policies (BL-002), a mail provider and its dead-letter handling (BL-028), secret masking tied to the real verification hand-off (BL-027), hosting; toolchain upgrades (BL-005, BL-006, BL-017); the help center and automated answers (`PROJECT_CONTEXT.md` §12 is future direction and §9 keeps a knowledge base out until the human operation works).
Dependencies: PH-1..PH-8 (approved).

## Product rules and acceptance scenarios
- RULE-SUP-03: a retried internal note is stored once; a failed send keeps the composer's text and attachments.
- RULE-SUP-02 / §5.4: a case an internal team still owes an answer is counted as waiting for a team whatever status staff set meanwhile.
- DEC-0017: every change to a case, reminders included, is decided on the locked row inside `CasesService`.
- §10.1: queue tabs are real tabs; settings number fields keep what was typed until submit; system messages are worded through the dictionary.
- §4.3: a customer can attach files to the very first message of a case.
- §4.5 / FND-0070: every 429 says when to retry; one client cannot keep the recovery route busy for everyone.
Scenarios are listed per subphase.

## Planned subphases, adjusted as evidence arrives
| ID | Block | Status |
|---|---|---|
| PH-9.1 | Case-domain debt: BL-022, BL-029, BL-013 (API), BL-018 — `PH-9.1.md`, approved 2026-09-14 | APPROVED |
| PH-9.2 | Staff workspace: BL-014, BL-013 (web), BL-024 carried items — `PH-9.2.md`, approved 2026-09-14 | APPROVED |
| PH-9.3 | Customer panel: BL-010, BL-015 — `PH-9.3.md`, approved 2026-09-14 | APPROVED |
| PH-9.4 | Operations and process: BL-009, BL-026, BL-023, BL-030; phase closure — `PH-9.4.md`, approved 2026-09-14 | APPROVED |

## Verification and operational readiness
Per subphase: unit and e2e tests for each behavior with its negative case; UI subphases observed in the browser smoke (new observations only, DEC-0034 c); `bash scripts/gate-commit.sh` for every commit. Phase candidate: `npm run verify:full`, `npm run test:pg -w api` and the full smoke.

## Completion evidence, findings and context updated
Approved on 2026-09-14 (`../evidence/PH-9-phase-approval.md`): the four subphases delivered BL-022, BL-029, BL-013, BL-018, BL-014, BL-024, BL-010, BL-015, BL-009, BL-023, BL-026 and part of BL-030; the integrated journey ran in Chromium on the phase candidate (full smoke, screenshots `../evidence/screenshots/ph-9/`), the api suites passed on PostgreSQL 16, and the gate and CI passed on every subphase commit.
Findings during the phase: the gate caught a timing race in the customer conversation (a retry toward a case that had just become unreachable — PH-9.2) and a test caught a race between an upload finishing and a send (PH-9.3); a probe through the built web disproved the first per-client limit design (PH-9.4). Each was fixed and recorded in its evidence.
Context updated: `ROADMAP.md` (PH-9 `APPROVED`, ledger cycle 3 → 3/3), `../audits/CYCLE-3.md` opened, DEC-0035–DEC-0038, `../BACKLOG.md`, the six feature contexts where affected, the runbooks, `../../CURRENT_STATE.md`, `../../SESSION_HANDOFF.md`.
PH-9 is cycle 3's third first-time approval: Cycle Audit 3 is due and ordinary feature work pauses until it closes (§6.4).
