# PH-7.2 — Roles and permissions
Type: SUBPHASE TECHNICAL PLAN
Status: ACTIVE
Parent: `PH-7.md`
Feature context: `../features/FEAT-ACCESS/CONTEXT.md`, `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`

## Objective, prerequisites and scope
Every staff action is allowed by an explicit rule the API enforces and the workspace mirrors, so responsibility is clear (`PROJECT_CONTEXT.md` §5.1, RULE-SUP-02, RULE-SUP-09) and BL-016 is decided. Prerequisite: PH-7.1. Out of scope: real staff accounts and revocation (Orbit's security policies, §10.2), role-gated unmasking, customer-side permissions.

## Affected boundaries and implementation approach
- Contracts (`packages/shared/src/identity.ts`): `STAFF_ACTIONS` and `staffMay(role, action, { owner: boolean })` — one table for API and web: `reply` (any staff; replying to an unowned case makes the replier responsible — unchanged), `take` (any staff on an unowned case), `set_status` / `resolve` / `close` / `consult` / `answer_consultation` / `edit_attributes` (owner, or supervisor/admin), `transfer` / `release` (owner or supervisor/admin — DEC-0012), `internal_note` (any staff), `incident` (any staff; incident resolution supervisor/admin), `saved_reply_edit_others` and `settings` / `supervision` (supervisor/admin — unchanged).
- Identity: `SimulatedOrbitIdentity` refuses staff ids outside the directory (401 `unknown_staff`) and takes the role from the directory; a header role that disagrees is ignored with a warning (the header stays only as a compatibility input for tests that use the directory's own role).
- API: `CasesService` checks `staffMay` inside `mutate` for every action listed; 403 `not_case_owner` (existing code reused where it exists) or 403 `role_required`.
- Web: the case view disables refused actions with the reason ("Só o responsável ou um supervisor…"), the picker shows the directory role, the saved-replies rule stays as is.

## Required behavior, failures and acceptance evidence
- An agent's status change, resolution, closure, consultation or attribute edit on a colleague's case → 403 with a stable code; the same by the owner or a supervisor → 200; replies remain open to any staff and never change an existing owner.
- An unknown staff id → 401 on every staff route; the role in the directory wins over the header.
- Every existing e2e and smoke journey still passes (the simulated staff act within their roles).
Acceptance evidence: `../evidence/PH-7.2-verification.md` (to be created).

## Work performed and important decisions
Pending.

## Verification, limitations and context updates
Pending.
