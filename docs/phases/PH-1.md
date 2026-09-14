# PH-1 — Foundation and end-to-end case skeleton
Type: PHASE CONTEXT
Status: ACTIVE
Objective / Feature IDs: OBJ-SUP-01, OBJ-SUP-03; FEAT-CASE, FEAT-CHAT, FEAT-STAFF (contexts created during this phase)
Cycle: 1 (see `ROADMAP.md`)

## Outcome and why now
A customer signed in to Orbit (simulated identity, labeled as such) opens "Suporte", sends a first request and receives a case reference; a staff member sees the case in the unassigned queue, takes it and replies; the customer sees the reply in the same conversation. Nothing exists yet, so the first phase must produce the executable, verifiable skeleton every later capability depends on — not a complete feature.

## Scope, non-goals and dependencies
In scope: workspace scaffold (Next.js + React + TypeScript frontend; NestJS + TypeScript backend; shared types), persistence, verification gate and CI, minimal customer panel (pt-BR), minimal staff queue and conversation, identity boundary with a simulated Orbit identity provider.
Non-goals: real-time delivery guarantees, attachments, full lifecycle statuses, Orbit record cards, notifications, supervision — later phases.
Dependencies: none external. ADR-0002 (dedicated project with explicit Orbit boundary).

## Product rules and acceptance scenarios
- Opening the panel does not create a case; the first message does (context §4.1).
- The case has a visible reference and a persistent conversation that survives a reload and a server restart (context §4.3).
- A customer sees only their own cases (RULE-SUP-01, basic enforcement; the role model is refined in PH-7).
- Staff replies are attributed to the staff account (RULE-SUP-09, basic).
- Customer UI copy is pt-BR with a structure that allows adding es later (context §10.1).
Acceptance: context §14 situation 2, demonstrated in both UIs — API success alone is not the screen (`GOVERNANCE.md` §6.3).

## Important uncertainties and decision references
- Package manager, monorepo layout and test runner: DEC-0004 (PH-1.1). Database: ADR-0003 — PostgreSQL dialect via Drizzle, embedded PGlite for dev/tests (PH-1.2).
- Real-time transport: deferred to PH-2; PH-1 may poll.
- Orbit identity: no Orbit code or API is available (BL-001). Simulated provider behind an interface, clearly labeled in UI and docs (ADR-0002).

## Planned subphases, adjusted as evidence arrives
| ID | Block | Status |
|---|---|---|
| PH-1.1 | Workspace scaffold, verification gate (lint, typecheck, unit tests), CI workflow, verification runbook, state/link checker (BL-003) — `PH-1.1.md`, approved 2026-09-13 | APPROVED |
| PH-1.2 | Case domain and API: create case with first message, list own cases, read conversation, staff unassigned queue, take, reply; persistence — `PH-1.2.md`, approved 2026-09-13 | APPROVED |
| PH-1.3 | Customer "Suporte" panel (Next.js, pt-BR): entry, new request, conversation, own cases — `PH-1.3.md`, approved 2026-09-13 | APPROVED |
| PH-1.4 | Minimal staff workspace: unassigned queue, conversation view, take, reply | PLANNED |
| PH-1.5 | Identity boundary: simulated Orbit identity/roles behind an interface; customer/staff access checks; feature contexts FEAT-CASE / FEAT-CHAT / FEAT-STAFF written | PLANNED |

## Verification and operational readiness
Gate defined in PH-1.1 (`docs/runbooks/VERIFICATION.md`). Phase approval requires: the gate passing on the candidate; the end-to-end scenario OBSERVED in both UIs; a negative case EXECUTED for cross-customer case access (RULE-SUP-01).

## Completion evidence, findings and context updated
Pending — no evidence exists.
