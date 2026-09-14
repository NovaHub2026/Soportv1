# PH-1.5 — Identity boundary hardening and feature contexts
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-1.md`
Feature context: `../features/FEAT-ORBIT/CONTEXT.md` (identity); writes `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`

## Objective, prerequisites and scope
Close PH-1 responsibly: make the simulated identity provider an explicit, environment-guarded choice so header-trusting identity cannot reach production by accident; expose who the API thinks the caller is; write the durable feature contexts the governance requires once capabilities exist (§3.1, §5.2); extend the context checker with the audit-ledger control (BL-004) before the first phase approval creates ledger state. Prerequisites: PH-1.1–1.4 approved. Out of scope: real Orbit adapter (needs Orbit), role-based permissions (PH-7).

## Affected boundaries and implementation approach
- `apps/api/src/identity/identity.module.ts`: `IdentityModule.forRoot(env)`; `resolveIdentityProviderName(env)` accepts only `simulated`, refuses `NODE_ENV=production` unless `SUPPORT_ALLOW_SIMULATED_IDENTITY=true`. Evaluated at bootstrap (factory), so the guard runs where the API starts.
- `apps/api/src/identity/identity.controller.ts`: `GET /api/identity/me` (any actor) returns the actor including `source`. `AnyActorGuard` added in `apps/api/src/identity/guards.ts`.
- `scripts/check-context.mjs`: audit-ledger checks — every APPROVED phase counted once, cycle status shows `n/3`, CURRENT_STATE repeats it, three approvals without an audit record fail (audit due).
- Feature contexts written from the code as it is, with scope and verified-against revision; `CONTEXT_INDEX.md` rows made live with source/test scope and dependency columns.

## Required behavior, failures and acceptance evidence
- Unknown provider name → startup error; production without opt-in → startup error (negative cases EXECUTED in unit tests).
- `/api/identity/me`: 200 with `source: 'simulated'` for customer/staff; 401 without identity or with ambiguous headers.
- Checker negatives: an APPROVED phase missing from the ledger fails; 3/3 without an audit record fails (EXECUTED in a disposable worktree).
Acceptance evidence: `../evidence/PH-1.5-verification.md`.

## Work performed and important decisions
DEC-0008 (identity provider selection and production refusal). Feature contexts FEAT-CASE, FEAT-CHAT, FEAT-STAFF, FEAT-ORBIT created; FEAT-NOTIFY and FEAT-ACCESS stay reserved. BL-004 delivered.

## Verification, limitations and context updates
Evidence: `../evidence/PH-1.5-verification.md`. Limitations: the production guard is an environment check, not a deployment control (PH-8 adds the runbook); feature contexts are `CURRENT` for `b5d3890` + this change and must be re-verified when their scope changes (§3.4).
Context updated: `PH-1.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `../runbooks/VERIFICATION.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`, `../../CLAUDE.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
