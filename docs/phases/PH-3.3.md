# PH-3.3 — Assignment and attributes
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-3.md`
Feature context: `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-ORBIT/CONTEXT.md` (roles)

## Objective, prerequisites and scope
Ownership can change without losing anything: the responsible agent transfers a case to a colleague or returns it to the queue; supervisors and admins can reassign any case (when someone becomes unavailable — context §5.2); priority and category can be corrected with attributable history (§5.4). Prerequisite: PH-3.2. Out of scope: a staff directory (simulated agents only), workload balancing, supervision views (PH-5).

## Affected boundaries and implementation approach
- Contracts: `assignCaseSchema` (`agentId | null`), `updateCaseSchema` (`priority?`, `category?`, at least one).
- API: `POST /api/staff/cases/:id/assign` — allowed for the current owner, for anyone when unowned, and for `supervisor` / `admin` roles (first role check; `ForbiddenException` otherwise); `case_assigned` event with `previousAgentId`, `released: true` when returning to the queue; consultations, history and timestamps untouched. `PATCH /api/staff/cases/:id` — `priority_changed` / `category_changed` events.
- Web: transfer picker (simulated agents, excluding self), "Devolver à fila", editable priority/category selects in the context column; queue and header reflect the new owner live; history labels.

## Required behavior, failures and acceptance evidence
- An agent cannot transfer someone else's case (403); a supervisor can; the owner can; unowned cases can be taken by assignment.
- Closed cases refuse assignment and attribute edits (409); an empty PATCH → 400.
- Transfer preserves messages, consultations and events; the queue shows the new owner within seconds.
Acceptance evidence: `../evidence/PH-3.3-verification.md`.

## Work performed and important decisions
DEC-0012: reassignment authority = current owner, anyone on an unowned case, or `supervisor` / `admin` (first use of `StaffActor.role`); release is a `case_assigned` event with `agentId: null` and `released: true`, keeping one event type for ownership history. Attribute edits are separate `priority_changed` / `category_changed` events with from → to. Transfer targets come from the simulated staff list until a directory exists.

## Verification, limitations and context updates
Evidence: `../evidence/PH-3.3-verification.md`. Limitations: no staff directory; no notification to the new owner beyond the live queue (PH-6).
Context updated: `PH-3.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-ORBIT/CONTEXT.md`, `../decisions/DECISION_LOG.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
