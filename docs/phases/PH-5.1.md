# PH-5.1 — Views for every state and attention signals
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-5.md`
Feature context: `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Staff can reach every case: the three existing views (unassigned, mine, all active) gain "Aguardando cliente", "Aguardando equipe", "Resolvidos" and "Encerrados"; every summary says since when the customer waits for a human reply, and the queues surface the oldest unanswered first where that matters (context §5.2, §14 item 9; BL-011 / FND-0023). Lists are paginated so a growing history stays usable. Prerequisite: PH-4. Out of scope: search/filters (PH-5.2), overdue configuration and overview (PH-5.4).

## Affected boundaries and implementation approach
- Contracts: `STAFF_QUEUE_VIEWS` += `waiting_customer`, `waiting_internal`, `resolved`, `closed`; `CaseSummary.awaitingReplySince` (staff-only: stripped from customer surfaces) = the customer's latest message time when it is newer than the latest staff reply on a case that is not waiting for the customer and not final; list query `limit` (default 50, max 200) and `offset`.
- API: `listStaffCases(actor, view, { limit, offset })` — ordering: unassigned oldest first; mine/active by `awaitingReplySince` oldest first then latest activity; waiting_customer by latest staff reply oldest first; waiting_internal by updated ascending; resolved by `resolvedAt` desc; closed by `closedAt` desc. Migration `0009`: index `(status, resolved_at)` and `(status, closed_at)`.
- Web: seven tabs; "Sem resposta há …" label and a data attribute on items awaiting a reply; "Carregar mais" when a page is full.

## Required behavior, failures and acceptance evidence
- A resolved case is listed under "Resolvidos" and disappears from active views; a closed one under "Encerrados"; `view=bogus` → 400; `limit=1000` → 400.
- `awaitingReplySince` is set after a customer message without a later staff reply and cleared by a staff reply; never sent to customers.
Acceptance evidence: `../evidence/PH-5.1-verification.md`.

## Work performed and important decisions
- Shared: `STAFF_QUEUE_VIEWS` (7 views), `staffListQuerySchema` (`limit` ≤ 200, `offset`), `CaseSummary.awaitingReplySince` (staff-only, stripped from customer surfaces).
- API: `listStaffCases(actor, view, { limit, offset })` with per-view ordering (unanswered first via a SQL twin of `awaitingReplySince`, NULLS LAST); migration `0009` indexes `(status, resolved_at)` and `(status, closed_at)`.
- Web: seven tabs, "Sem resposta há …" and "Aguardando o cliente há …" labels, "Carregar mais" (pages per view); `formatDuration` helper.
- DEC-0021: view semantics and ordering — active views surface the oldest unanswered customer message first, waiting views the oldest wait first, history newest first; `awaitingReplySince` is the single "needs a human reply" signal for lists, the overview (PH-5.4) and metrics.

## Verification, limitations and context updates
Evidence: `../evidence/PH-5.1-verification.md`. Limitations: offset pagination (fine at this scale; cursor pagination when PH-8 sizes the deployment).
Context updated: `PH-5.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../BACKLOG.md` (BL-011), `../decisions/DECISION_LOG.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
