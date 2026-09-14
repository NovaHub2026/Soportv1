# PH-3.5 — Shared incidents and phase closure
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-3.md`
Feature context: `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`

## Objective, prerequisites and scope
Several customer cases can refer to one shared incident (`PROJECT_CONTEXT.md` §5.4): staff create an incident, link cases to it, send one internal note to every linked case ("coordinated updates") and mark the incident resolved — without resolving any customer's case automatically. Conversations stay separate. Then close PH-3: integrated smoke, feature contexts, phase approval — which makes the ledger 3/3 and opens the Cycle Audit. Prerequisite: PH-3.4. Out of scope: public incident status pages, automatic linking, customer-facing incident notices (PH-6 may add notices).

## Affected boundaries and implementation approach
- Migration `0006`: `incidents` (title, description, status `open | resolved`, creator, timestamps) and `support_cases.incident_id`.
- Contracts: `Incident`, `createIncidentSchema`, `linkIncidentSchema` (`incidentId | null`), `incidentNoteSchema`; `CaseSummary.incidentId`, `incidentTitle`.
- API (staff): `POST/GET /api/staff/incidents`, `POST /api/staff/incidents/:id/resolve` (cases untouched; an internal system note lands on linked open cases), `POST /api/staff/incidents/:id/notes` (internal note broadcast to linked open cases), `POST /api/staff/cases/:id/incident` (link/unlink, `incident_linked` event).
- Web (staff): "Incidente" section in the case context — link to an open incident or create one, unlink, broadcast note, resolve; queue tag "Incidente"; customer surfaces unchanged.

## Required behavior, failures and acceptance evidence
- Broadcast notes are internal: never on customer surfaces or counts (existing filters; asserted).
- Resolving an incident changes no case status; linked case count and titles appear on staff summaries; customer → 403 on all incident endpoints; linking to a resolved or unknown incident → 409/404.
Acceptance evidence: `../evidence/PH-3.5-verification.md` and `../evidence/PH-3-phase-approval.md`.

## Work performed and important decisions
DEC-0014 (simple association; broadcast = internal notes; resolving an incident never resolves cases). Phase closure performed in this subphase: integrated smoke on the candidate, feature contexts refreshed, `../evidence/PH-3-phase-approval.md`, ledger 3/3 and the Cycle Audit record opened.

## Verification, limitations and context updates
Evidence: `../evidence/PH-3.5-verification.md`, `../evidence/PH-3-phase-approval.md`. Limitations: no customer-facing incident notice (PH-6); no incident list screen beyond the picker (PH-5 if useful).
Context updated: `PH-3.md`, `ROADMAP.md` (ledger 3/3), `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../audits/CYCLE-1.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
