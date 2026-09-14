# PH-3 — Case lifecycle and staff collaboration
Type: PHASE CONTEXT
Status: APPROVED
Objective / Feature IDs: OBJ-SUP-03, OBJ-SUP-04; FEAT-CASE, FEAT-STAFF, FEAT-CHAT
Cycle: 1 (see `ROADMAP.md`; PH-1 and PH-2 counted, 2/3 — this phase's approval triggers the Cycle Audit)

## Outcome and why now
A case's status always means the work still required, and every active case has a responsible person until a supported conclusion: staff move cases between "em atendimento", "aguardando cliente" and "aguardando equipe interna", resolve them with a reason and an explanation the customer can understand, collaborate through internal notes and consultations with other teams, transfer ownership without losing history, adjust priority and category, and let closed matters continue through a linked follow-up. Customers can always say "Ainda preciso de ajuda" (`PROJECT_CONTEXT.md` §5.2–5.4, §7).

## Scope, non-goals and dependencies
In scope: staff status transitions; resolution with reason codes + customer-facing explanation; internal notes composer; specialist consultation (team, question, answer, pending indicator); transfer/release/reassign with history; priority/category edits; scheduled closure after the follow-up window (7 days, configurable — context §13.1); linked follow-up from a closed case; simple shared incidents (association + coordinated notes).
Non-goals: queue filters/search, saved replies, supervision dashboards, service metrics (PH-5); notifications/reminders (PH-6); Orbit record cards (PH-4); a project-management system for specialists (context §5.3).
Dependencies: PH-1, PH-2 (approved).

## Product rules and acceptance scenarios
- RULE-SUP-02: transfer and consultation preserve follow-through; an unassigned case stays in the queue; a case never loses its responsible person silently.
- RULE-SUP-04: notes and consultations are internal only — never in customer lists, details, streams or unread counts.
- RULE-SUP-05: resolving/closing changes no money or account state (the system has no such powers; explicit).
- RULE-SUP-06: resolved → any customer message reactivates; closed → linked follow-up with the previous context.
- RULE-SUP-09: every transition, transfer, consultation, resolution and closure is an attributable event.
Scenarios (context §14 items 3, 5, 9): (a) agent asks for information → "Aguardando sua resposta" for the customer → customer replies → back to "Em atendimento"; (b) agent consults Finance → customer sees "Em análise", staff see the pending question; specialist answers → owner alerted, status back to in progress; (c) agent resolves with reason + explanation → customer sees "Resolvido" and the explanation, clicks "Ainda preciso de ajuda" → same case reactivated with full history; (d) transfer to another agent keeps history and the queue shows the new owner; (e) a case resolved more than 7 days ago closes automatically; "Preciso de mais ajuda" opens a linked follow-up with a new reference and access to the previous one; (f) two cases linked to one incident receive coordinated internal notes; resolving the incident does not resolve the cases.

## Important uncertainties and decision references
- Resolution reasons are working defaults (decision log) to refine with Operations (BL-002).
- Consultation "teams" are a fixed list for now (Finance, Operations, Security, Verification, Product); real routing to those teams needs Orbit's org (BL-002).
- Closure job cadence and window are configurable; production scheduling is PH-8.

## Planned subphases, adjusted as evidence arrives
| ID | Block | Status |
|---|---|---|
| PH-3.1 | Status transitions by staff (waiting for customer / internal team / resume), resolution with reason + customer-facing explanation, customer "Ainda preciso de ajuda" — `PH-3.1.md`, approved 2026-09-13 | APPROVED |
| PH-3.2 | Internal notes composer and specialist consultation (team, question, pending indicator, answer) — `PH-3.2.md`, approved 2026-09-13 | APPROVED |
| PH-3.3 | Assignment: transfer, release to queue, supervisor reassignment; priority and category edits — `PH-3.3.md`, approved 2026-09-13 | APPROVED |
| PH-3.4 | Closure after the follow-up window (scheduled job) and linked follow-up from a closed case — `PH-3.4.md`, approved 2026-09-13 | APPROVED |
| PH-3.5 | Shared incidents (simple association, coordinated notes) and phase closure — `PH-3.5.md`, approved 2026-09-13 | APPROVED |

## Verification and operational readiness
Unit + e2e per subphase with negatives (customer cannot call staff transitions; notes never leak); browser smoke extended with resolve → "Ainda preciso de ajuda" and consultation; `npm run verify` and `npm run build` on the phase candidate. Operational note: the closure job runs inside the API process (single instance until PH-8).

## Completion evidence, findings and context updated
Approved 2026-09-13 — `../evidence/PH-3-phase-approval.md`: scenarios (a)–(f) mapped to executed tests and browser observations on the phase candidate (screenshots `../evidence/screenshots/ph-3/`). Subphase evidence: `../evidence/PH-3.1-verification.md` … `../evidence/PH-3.5-verification.md`.
Findings: none open from this phase (smoke-locator ambiguities were harness-only). Backlog unchanged.
Context updated: feature contexts FEAT-CASE / FEAT-STAFF / FEAT-CHAT / FEAT-ORBIT; `ROADMAP.md` ledger (cycle 1, 3/3 — **Cycle Audit due, record `../audits/CYCLE-1.md`**); `../../CURRENT_STATE.md`; DEC-0010–DEC-0014.
Everything runs on simulated identity and no Orbit records (DEC-0003).
