# PH-3.2 — Internal notes and specialist consultation
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-3.md`
Feature context: `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Staff can investigate and ask colleagues for help without publishing anything to the customer: internal notes in the conversation, and consultations to another team (Finance, Operations, Security, Verification, Product) with a clear question, a visible pending state and an answer that brings the case back to the owner (`PROJECT_CONTEXT.md` §5.3, §7.2). Prerequisite: PH-3.1. Out of scope: real routing to Orbit's teams (BL-002), subtasks or a project-management model (context §5.3 non-goal).

## Affected boundaries and implementation approach
- Contracts: `CONSULTATION_TEAMS`, `CaseConsultation` (id, case, team, question, requestedBy, requestedAt, answeredBy, answeredAt, answer, status `open | answered`), `postNoteSchema`, `requestConsultationSchema`, `answerConsultationSchema`; `StaffCaseDetail.consultations`; `CaseSummary.openConsultations` (count).
- Schema migration `0004`: `case_consultations`.
- API (staff only): `POST /api/staff/cases/:id/notes` → internal-visibility message (never in customer detail, streams or unread counts — existing filters; negative tests at every layer); `POST /api/staff/cases/:id/consultations` → row + event `consultation_requested` + status `waiting_internal`; `POST /api/staff/cases/:id/consultations/:cid/answer` → answer + event `consultation_answered` + status `in_progress` if no other consultation stays open; `case.updated` published so the owner's workspace refreshes live.
- Web (staff): composer mode toggle "Responder ao cliente" / "Nota interna" (visibly different, RULE-SUP-04); "Consultar equipe" form (team + question); pending consultations listed in the header/context with "Responder consulta" form; consultation events in the history. Customer: unchanged surfaces ("Em análise" while waiting for the internal team).

## Required behavior, failures and acceptance evidence
- Notes and consultations never reach a customer: detail, customer streams, unread counts (e2e/unit negatives).
- Requesting a consultation on an unowned case assigns the requester; the customer status shows "Em análise"; a customer reply while waiting keeps the dependency (existing).
- Answering restores `in_progress` and records who answered; answering twice → 409; unknown team → 400.
Acceptance evidence: `../evidence/PH-3.2-verification.md`.

## Work performed and important decisions
DEC-0011: consultations are rows, not messages — a question with a team, a requester, a status and an answer — so pending work is visible and countable; notes reuse messages with `internal` visibility. Any staff member can answer a consultation (roles come with PH-7); the case returns to `in_progress` only when no consultation stays open. Notes do not touch `lastMessageAt` / `lastStaffMessageAt` (they are not customer-facing activity).

## Verification, limitations and context updates
Evidence: `../evidence/PH-3.2-verification.md`. Limitations: no routing or notification to the consulted team (BL-002); `CaseSummary` does not yet carry an open-consultation count for queue views (PH-5 if useful).
Context updated: `PH-3.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../decisions/DECISION_LOG.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
