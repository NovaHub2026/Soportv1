# PH-5.3 — Saved replies
Type: SUBPHASE TECHNICAL PLAN
Status: PLANNED
Parent: `PH-5.md`
Feature context: `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Agents answer recurring questions consistently and faster by inserting a saved reply into the composer and adjusting it before sending; the team maintains the list (create, edit, remove) with attributable changes (context §5.2, §5.4, RULE-SUP-09; scenario (e) of `PH-5.md`). Prerequisite: PH-5.2. Out of scope: variables/placeholders in replies, per-agent private replies, approval workflows.

## Affected boundaries and implementation approach
- Contracts: `SavedReply { id, title, body, category | null, createdById/Name, updatedById/Name, createdAt, updatedAt }`, `savedReplySchema` for create/update (title 1–120, body 1–5000, optional category).
- Schema migration `0010`: `saved_replies`.
- API: `GET /api/staff/saved-replies` (all, by title), `POST` (any staff), `PATCH /:id` and `DELETE /:id` (author, supervisor or admin — otherwise 403 `not_reply_author`), all behind `StaffGuard`; edits record `updatedBy*`.
- Web: "Resposta salva" picker in the reply composer (inserts the body into the draft at the cursor end), and a "Respostas salvas" management panel in the workspace (list, new, edit, delete) reachable from the topbar.

## Required behavior, failures and acceptance evidence
- Customers → 403; validation → 400; an agent cannot edit another agent's reply (403) but a supervisor can; a deleted reply disappears from the picker.
- Inserting a reply never sends by itself; the draft stays editable.
Acceptance evidence: `../evidence/PH-5.3-verification.md`.

## Work performed and important decisions
Filled at approval.

## Verification, limitations and context updates
Evidence: `../evidence/PH-5.3-verification.md`. Limitations: no placeholders; management panel is role-neutral for creation (any staff), gated for edits of others' replies.
Context updated at approval: `PH-5.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../runbooks/VERIFICATION.md`.
