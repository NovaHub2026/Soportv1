# PH-3.4 — Closure and linked follow-up
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-3.md`
Feature context: `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`

## Objective, prerequisites and scope
"Closed" gets its real meaning (`PROJECT_CONTEXT.md` §7.3–7.4): a resolved case that stays quiet for the follow-up window closes automatically; staff can close explicitly; a closed case never swallows a customer's need — "Preciso de mais ajuda" opens a linked follow-up with a new reference and access to the previous context (RULE-SUP-06). Prerequisite: PH-3.3. Out of scope: retention/deletion policy (BL-002, PH-8), reminders before closure (PH-6).

## Affected boundaries and implementation approach
- Schema migration `0005`: `support_cases.parent_case_id` (self-reference), `closed_reason` (`auto_window | staff`).
- Contracts: `CaseSummary.parentCaseId`, `parentReference`; `followUpSchema` (message).
- API: `ClosureJob` (Nest `OnModuleInit`/`OnModuleDestroy`, `setInterval`; `SUPPORT_FOLLOW_UP_WINDOW_DAYS` default 7, `SUPPORT_CLOSURE_INTERVAL_MS` default 60 000, disabled when `SUPPORT_CLOSURE_JOB=off` — tests call `closeExpired(now)` directly); `POST /api/staff/cases/:id/close` (from `resolved` only); `POST /api/support/cases/:id/follow-up {message}` → new case for the same customer with `parentCaseId`, category inherited, a system message "Continuação de SUP-…", `follow_up_created` events on both, `case.updated` for both.
- Web: customer closed notice gets "Preciso de mais ajuda" (opens the follow-up conversation) and a link back from the follow-up header ("Continuação de SUP-…"); staff header shows the parent reference and "Encerrar caso" for resolved cases; history labels.

## Required behavior, failures and acceptance evidence
- Only `resolved` cases close (job or staff); a customer message on `closed` stays 409; a follow-up from a non-closed case → 409; another customer → 404.
- The job is idempotent and only touches cases whose `resolvedAt` is older than the window; a customer reply during the window reactivates instead (existing rule) — message arriving around closing time lands in the resumed case or the follow-up, never lost (§7.4: covered by the 409 + explicit follow-up path).
Acceptance evidence: `../evidence/PH-3.4-verification.md`.

## Work performed and important decisions
DEC-0013: closure is a state transition only from `resolved`, performed by the in-process `ClosureJob` (`SUPPORT_FOLLOW_UP_WINDOW_DAYS`=7, `SUPPORT_CLOSURE_INTERVAL_MS`=60 000, `SUPPORT_CLOSURE_JOB=off` to disable) or explicitly by staff; `closed_reason` records which. A follow-up is a new case with `parent_case_id`, inherited category, a system message pointing back and `follow_up_created` events on both cases; summaries carry `parentReference`. Customer messages on a closed case stay refused (409) — the UI routes the customer to the follow-up form instead.

## Verification, limitations and context updates
Evidence: `../evidence/PH-3.4-verification.md`. Limitations: the job runs in one API process (PH-8 scheduling); no reminder before closure (PH-6).
Context updated: `PH-3.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../runbooks/VERIFICATION.md`, `../decisions/DECISION_LOG.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
