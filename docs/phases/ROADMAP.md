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
| PH-9 | Release-candidate debt: the Agent-owned backlog the audits carried past PH-8 — case-domain rules, staff workspace, customer panel, operations and harness (`PH-9.md`). Opened on the Owner's «continua con las siguientes fases pendientes». | OBJ-SUP-03, -04; RULE-SUP-02, -03; BL-009, -010, -013, -014, -015, -018, -022, -023, -024, -026, -029, -030 | `APPROVED` | PH-1..8 |
| PH-10 | Operating policies in the product (DEC-0039): 24/7 schedule, times shown in the customer's time zone, formal complaints (customer topic, supervisor, 5 business days), admin export of a customer's data on request, recovery forwarded to the Verification team | OBJ-SUP-03, -04; RULE-SUP-01, -08, -09; BL-002 | `APPROVED` | PH-9, DEC-0039 |
| PH-11 | AI assistant as the first line (BL-031): answers from approved content and authorized account data, transfers to a person on request or when it cannot help, the human team 24/7 behind it | OBJ-SUP-05; RULE-SUP-04, -07, -10 | `PLANNED` | PH-10; Owner: provider account and cost |
| PH-12 | Project closure (Owner, 2026-09-14: close everything except PH-11): the last Agent-owned debt (BL-017, BL-027, BL-028, BL-030), a closing audit of PH-10 and PH-12.1, the PH-11 brief for a GPT build, the internal demo release `v0.2.0-demo`, the closure record (`PH-12.md`) | all; RULE-SUP-03; §4.5, §7.5, §12.1 | `APPROVED` | PH-10 |

Future direction, not scheduled: help center, staff assistance, automated answers — `PROJECT_CONTEXT.md` §12 (OBJ-SUP-05, RULE-SUP-10). Continuity decisions in PH-1..3 must not preclude them.

## Active chain
Phase: none active — the project is closed except PH-11 (Owner, 2026-09-14). PH-1..PH-10 and PH-12 `APPROVED` (PH-12 approved 2026-09-14, `PH-12.md`, evidence `../evidence/PH-12-phase-approval.md`); every cycle audit through cycle 3 and the closing audit (`../audits/CLOSING.md`, out of band) are CLOSED. Cycle 4 is at 2/3 (PH-10, PH-12). PH-11 (AI assistant first line) stays `PLANNED`: the Owner builds it directly with GPT from `PH-11.md`; its first approval brings cycle 4 to 3/3 and makes Cycle Audit 4 due (`PH-12.md` "After closure"). Internal demos: `v0.1.0-demo` (superseded), `v0.1.1-demo`, `v0.2.0-demo` (`../evidence/RELEASE-2026-09-14c.md`, everything delivered). A production release still needs the Owner (§1.1), Orbit's adapters (BL-001) and the two open policies (retention, e-mail provider — BL-002). The ledger table below is the only owner of the audit count.

## Audit ledger
Cadence: Cycle Audit after 3 first-time phase approvals (§6.4). Inherited debt: none.

| Cycle | Counted phase (first approval) | Approved on | Audit record | Status |
|---|---|---|---|---|
| 1 | PH-1, PH-2, PH-3 | 2026-09-13 | `../audits/CYCLE-1.md` | 3/3, audit CLOSED 2026-09-14 |
| 2 | PH-4, PH-5, PH-6 | 2026-09-14 | `../audits/CYCLE-2.md` | 3/3, audit CLOSED 2026-09-14 (remediation `../evidence/CYCLE-2-verification.md`) |
| 3 | PH-7, PH-8, PH-9 | 2026-09-14 | `../audits/CYCLE-3.md` (the out-of-band `../audits/CYCLE-3-OOB.md` did not reset the cycle) | 3/3, audit CLOSED 2026-09-14 (remediation `../evidence/CYCLE-3-closure-verification.md`) |
| 4 | PH-10, PH-12 | 2026-09-14 | — (the out-of-band `../audits/CLOSING.md` did not reset the cycle) | 2/3 — Cycle Audit 4 due at PH-11's first approval |
