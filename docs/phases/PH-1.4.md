# PH-1.4 — Minimal staff workspace
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-1.md`
Feature context: none yet (FEAT-STAFF context is written in PH-1.5)

## Objective, prerequisites and scope
Give the support team a real screen for the PH-1 journey (`PROJECT_CONTEXT.md` §5.1–5.2): queues (unassigned / mine / all active), the full conversation of a case with internal notes visibly distinct from customer-facing messages, take, reply, and a context column with the customer/case facts we actually have. Route `/staff` in `apps/web`. Prerequisite: PH-1.2 staff endpoints, PH-1.3 web foundations. Out of scope: internal-note composer, transfers, priority/category editing, consultation, resolve/close (PH-3); filters/search, saved replies, supervision (PH-5); Orbit record cards (PH-4).

## Affected boundaries and implementation approach
- `apps/web/src/app/staff/page.tsx` → `apps/web/src/features/staff/StaffWorkspace.tsx` (client): topbar with **Simulação** badge and simulated-agent picker (`useSimulatedStaff`), three-column grid: `StaffQueue` (tabs per `STAFF_QUEUE_VIEWS`, 10 s refresh, refreshed immediately after actions via a token), `StaffCaseView` (5 s refresh; take button only when unowned and open; reply composer labeled "Resposta ao cliente"; internal notes rendered with a dashed warning border and the tag "Nota interna · visível só para a equipe") and `CaseContext` (customer id + identity source "Simulada", an explicit "Orbit data unavailable" note — RULE-SUP-07 — case facts and the event timeline from `case_events`).
- `apps/web/src/lib/staff-api.ts` (staff headers) over the shared `apiRequest` in `apps/web/src/lib/api.ts`; `apps/web/src/lib/simulated-session.ts` generalized to customer and staff stores.
- pt-BR staff copy under `staff` in `apps/web/src/i18n/pt-BR.ts`, including staff-facing status labels ("Novo", "Aguardando cliente"…) distinct from customer labels; `fill()` for event templates.
- `scripts/ui-smoke.mjs` now drives the staff workspace instead of calling the API: queue → open → take → reply → queues update → customer sees the reply.

## Required behavior, failures and acceptance evidence
- The unassigned queue lists new cases oldest first; after take, the case leaves it and appears under "Meus casos" (RULE-SUP-02).
- Take shows the responsible agent and status "Em atendimento"; a conflict (someone else took it) shows an error, not a silent failure.
- Public replies are attributed to the agent and reach the customer panel; internal notes never look like replies (RULE-SUP-04).
- Missing Orbit context is shown as unavailable, never as an assumed value (RULE-SUP-07).
- Every material action is visible in the history column (RULE-SUP-09).
Acceptance evidence: `../evidence/PH-1.4-verification.md` (5 component tests EXECUTED, 18 total in web; 11 browser observations OBSERVED with screenshots).

## Work performed and important decisions
DEC-0007: staff UI copy in pt-BR by default (dictionary-based, refinable with the operating team per context §10.1); responsible agent shown by id until staff profiles exist; context column hides below 1100 px (desktop-first workspace).

Known gaps carried forward: no internal-note composer or "waiting for customer" transition on reply (PH-3); staff identity trusts simulated headers (PH-1.5 formalizes labeling and role checks); no pagination or search (PH-5).

Finding FND-0002 (MATERIAL) found by reviewing the first smoke screenshot: a refresh that raced an action could overwrite the action's result, making a sent reply disappear for up to one refresh interval on both UIs. Fixed in this subphase with a monotonic request counter and post-action re-reads; the smoke now asserts messages stay visible 2.5 s after sending.

## Verification, limitations and context updates
Evidence: `../evidence/PH-1.4-verification.md`. Limitations: same browser-environment workaround as PH-1.3 (BL-007); no keyboard-only walkthrough beyond semantic roles/labels.
Context updated: `PH-1.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `../runbooks/VERIFICATION.md`, `../decisions/DECISION_LOG.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
