# PH-3.1 — Status transitions and resolution
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-3.md`
Feature context: `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`

## Objective, prerequisites and scope
Staff can express what a case is waiting for and conclude it honestly: move a case to "aguardando cliente" or "aguardando equipe interna" and back to "em atendimento"; resolve with a reason code and an explanation the customer reads in the conversation; the customer can reactivate a resolved case with one click ("Ainda preciso de ajuda"). Prerequisite: PH-2. Out of scope: consultations (PH-3.2), transfers (PH-3.3), closure (PH-3.4).

## Affected boundaries and implementation approach
- Contracts: `STAFF_STATUS_TARGETS` (`in_progress`, `waiting_customer`, `waiting_internal`), `RESOLUTION_REASONS`, `setStatusSchema`, `resolveCaseSchema`; `CaseSummary.resolutionReason`; new event types (`case_resolved`, and the PH-3 vocabulary added to the enum in one migration).
- Schema migration `0003`: `support_cases.resolution_reason`; enum values for PH-3 events.
- API: `POST /api/staff/cases/:id/status` and `POST /api/staff/cases/:id/resolve` (assigns the actor if the case is unowned — RULE-SUP-02; events `status_changed` / `case_resolved`; the explanation is a public staff message so it lives in the conversation and reaches the customer live). Customer reactivation stays message-based (§7.2 simple rule): the UI button sends "Ainda preciso de ajuda." through the existing endpoint.
- Web staff: action bar (Aguardar cliente / Aguardar equipe interna / Retomar / Resolver…) with an inline resolution form (reason + explanation); customer: resolved notice with the explanation context and the "Ainda preciso de ajuda" button; pt-BR labels for reasons.

## Required behavior, failures and acceptance evidence
- Customers cannot call staff transitions (403); transitions on `closed` are refused (409); resolving requires reason and non-empty explanation (400).
- Resolve → status `resolved`, `resolvedAt`, `resolutionReason`, public explanation message, `case_resolved` event; customer message afterwards → `in_progress` + `case_reopened` (existing) and `resolvedAt` cleared.
- Waiting-for-customer → customer reply returns to `in_progress` (existing); waiting-internal → customer reply keeps the dependency (existing).
Acceptance evidence: `../evidence/PH-3.1-verification.md`.

## Work performed and important decisions
DEC-0010: resolution reasons as a fixed working list (`solved`, `answered`, `no_action_possible`, `handled_elsewhere`, `duplicate`, `no_customer_response`) refinable with Operations; the explanation is a normal public staff message so it travels through the existing conversation, stream and unread machinery; `resolved` is never set directly through `/status`. The PH-3 event vocabulary was added to the database enum in one migration to avoid four enum migrations in a row.

## Verification, limitations and context updates
Evidence: `../evidence/PH-3.1-verification.md`. Limitations: "waiting for internal team" is a manual status until PH-3.2 ties it to consultations; reasons are working defaults (BL-002).
Context updated: `PH-3.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../decisions/DECISION_LOG.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
