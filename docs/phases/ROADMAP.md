# ROADMAP — Orbit Support
Type: ROADMAP AND AUDIT LEDGER
Updated: 2026-09-14
Derived from: `PROJECT_CONTEXT.md` v1.0 (§9 scope, §14 success situations); first drawn on an empty repository (2026-09-13), maintained with each phase

Near-term work is detailed; later phases are at outcome level and are refined just in time (`GOVERNANCE.md` §6.1). Ordering favors a thin end-to-end slice first so every later capability lands on a verifiable foundation.

## Phases
| ID | Capability | Objectives / rules | Status | Depends on |
|---|---|---|---|---|
| PH-1 | Foundation and end-to-end case skeleton: customer submits a request → persistent case with reference → staff sees it, takes it, replies → customer sees the reply. Includes workspace scaffold, verification gate and CI. | OBJ-SUP-01, -03; RULE-SUP-01 (basic), -09 (basic) | `APPROVED` | — |
| PH-2 | Conversation reliability and continuity: live updates, send/unread states, idempotent retry and reconnection, multiple cases per customer, image/PDF attachments with protected access. | OBJ-SUP-01, -04; RULE-SUP-03, -06 | `APPROVED` | PH-1 |
| PH-3 | Case lifecycle and staff collaboration: statuses, assignment/transfer, priority/categories, internal notes, specialist consultation, resolve/reopen/close, linked follow-up, attributable history. | OBJ-SUP-03; RULE-SUP-02, -04, -05, -06, -09 | `APPROVED` | PH-1 |
| PH-4 | Orbit context integration: identity summary, record cards, contextual entry ("Preciso de ajuda"), masking, visibly unavailable data; real adapter or labeled simulation. | OBJ-SUP-02; RULE-SUP-01, -07 | `APPROVED` | PH-1, ADR-0002, BL-001 |
| PH-5 | Staff workspace completeness and supervision: essential views, filters/search, saved replies, schedule/config, queue oversight, service metrics. | OBJ-SUP-03; RULE-SUP-02, -08 | `ACTIVE` | PH-3 |
| PH-6 | Notifications and availability: in-product notifications, email notifications linking back, outside-hours behavior. | OBJ-SUP-04; RULE-SUP-08 | `PLANNED` | PH-2 |
| PH-7 | Access recovery and privacy hardening: "Não consigo acessar minha conta" route, roles/permissions review, shared-device sign-out, shared incidents. | OBJ-SUP-04; RULE-SUP-01, -04 | `PLANNED` | PH-3, PH-4 |
| PH-8 | Production readiness: operating policies (retention, complaints), deployment, release runbook. The release itself needs Owner authorization (§1.1). | all | `PLANNED` | PH-1..7, BL-002 |

Future direction, not scheduled: help center, staff assistance, automated answers — `PROJECT_CONTEXT.md` §12 (OBJ-SUP-05, RULE-SUP-10). Continuity decisions in PH-1..3 must not preclude them.

## Active chain
Phase: PH-5 `ACTIVE` since 2026-09-14 (`PH-5.md`) — PH-5.1 `APPROVED` 2026-09-14 (`PH-5.1.md`, evidence `../evidence/PH-5.1-verification.md`); next PH-5.2 (filters and search). PH-1..PH-4 `APPROVED` (PH-4 evidence `../evidence/PH-4-phase-approval.md`). Cycle 2 ledger: 1/3. PH-1, PH-2 and PH-3 `APPROVED` 2026-09-13 (evidence `../evidence/PH-1-phase-approval.md`, `../evidence/PH-2-phase-approval.md`, `../evidence/PH-3-phase-approval.md`). Cycle Audit 1 CLOSED 2026-09-14 (`../audits/CYCLE-1.md`, remediation evidence `../evidence/CYCLE-1-verification.md`).

## Audit ledger
Cadence: Cycle Audit after 3 first-time phase approvals (§6.4). Inherited debt: none.

| Cycle | Counted phase (first approval) | Approved on | Audit record | Status |
|---|---|---|---|---|
| 1 | PH-1, PH-2, PH-3 | 2026-09-13 | `../audits/CYCLE-1.md` | 3/3, audit CLOSED 2026-09-14 |
| 2 | PH-4 | 2026-09-14 | — | 1/3, open cycle |
