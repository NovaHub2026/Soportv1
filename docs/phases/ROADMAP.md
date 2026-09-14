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
| PH-5 | Staff workspace completeness and supervision: essential views, filters/search, saved replies, schedule/config, queue oversight, service metrics. | OBJ-SUP-03; RULE-SUP-02, -08 | `APPROVED` | PH-3 |
| PH-6 | Notifications and availability: in-product notifications, email notifications linking back, outside-hours behavior. | OBJ-SUP-04; RULE-SUP-08 | `APPROVED` | PH-2 |
| PH-7 | Access recovery and privacy hardening: "Não consigo acessar minha conta" route, roles/permissions review, shared-device sign-out, shared incidents. | OBJ-SUP-04; RULE-SUP-01, -04 | `APPROVED` | PH-3, PH-4 |
| PH-8 | Production readiness: operating policies (retention, complaints), deployment, release runbook. The release itself needs Owner authorization (§1.1). | all | `APPROVED` | PH-1..7, BL-002 |
| PH-9 | Release-candidate debt: the Agent-owned backlog the audits carried past PH-8 — case-domain rules, staff workspace, customer panel, operations and harness (`PH-9.md`). Opened on the Owner's «continua con las siguientes fases pendientes». | OBJ-SUP-03, -04; RULE-SUP-02, -03; BL-009, -010, -013, -014, -015, -018, -022, -023, -024, -026, -029, -030 | `ACTIVE` | PH-1..8 |

Future direction, not scheduled: help center, staff assistance, automated answers — `PROJECT_CONTEXT.md` §12 (OBJ-SUP-05, RULE-SUP-10). Continuity decisions in PH-1..3 must not preclude them.

## Active chain
Phase: PH-9 `ACTIVE` (`PH-9.md`) — PH-9.1 (case-domain debt) and PH-9.2 (staff workspace debt, `../evidence/PH-9.2-verification.md`) approved; next PH-9.3 (customer panel). PH-1..PH-8 `APPROVED`. Internal demos: `v0.1.0-demo` (superseded), `v0.1.1-demo` (`../evidence/RELEASE-2026-09-14b.md`). Cycle Audits 1 and 2 CLOSED; the cycle 3 out-of-band audit CLOSED (`../audits/CYCLE-3-OOB.md`). PH-9's approval will be cycle 3's third first-time approval: the Cycle Audit is due then (§6.4). A production release still needs the Owner (§1.1), Orbit's adapters (BL-001) and the operating policies (BL-002). The ledger table below is the only owner of the audit count.

## Audit ledger
Cadence: Cycle Audit after 3 first-time phase approvals (§6.4). Inherited debt: none.

| Cycle | Counted phase (first approval) | Approved on | Audit record | Status |
|---|---|---|---|---|
| 1 | PH-1, PH-2, PH-3 | 2026-09-13 | `../audits/CYCLE-1.md` | 3/3, audit CLOSED 2026-09-14 |
| 2 | PH-4, PH-5, PH-6 | 2026-09-14 | `../audits/CYCLE-2.md` | 3/3, audit CLOSED 2026-09-14 (remediation `../evidence/CYCLE-2-verification.md`) |
| 3 | PH-7, PH-8 | 2026-09-14 | `../audits/CYCLE-3-OOB.md` (out-of-band audit; does not reset the cycle) | 2/3 |
