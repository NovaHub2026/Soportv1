# Access recovery and privacy
Type: FEATURE CONTEXT
Feature ID: FEAT-ACCESS
Lifecycle: PLANNED (PH-7 started 2026-09-14; nothing implemented yet)
Freshness: CURRENT
Verified against: the PH-7 start commit (documentation only)
Verified on: 2026-09-14
Scope (planned, to be created): `packages/shared/src/access.ts`, `apps/api/src/access/`, `apps/web/src/features/access/`, staff page `apps/web/src/features/staff/AccessRecoveryPanel.tsx`; sign-out in `apps/web/src/lib/simulated-session.ts` and the shells; permission table in `packages/shared/src/identity.ts` (PH-7.2)

## User outcome and applicable product rules
Someone unable to sign in can ask for help through a visible route without obtaining any private account history before verification (`PROJECT_CONTEXT.md` §4.5, §14 item 8); staff act within clear roles (§5.1, RULE-SUP-02); signing out on a shared device leaves nothing of the previous customer (§10.2). Rules: RULE-SUP-01 (knowing an id is insufficient), RULE-SUP-04 (restricted information never reaches customers), RULE-SUP-02 (responsibility is clear).

## Current behavior and known gaps
Not implemented. Planned by subphase: PH-7.1 recovery route (`PH-7.1.md`), PH-7.2 roles and permissions (BL-016 → DEC-0028), PH-7.3 shared-device sign-out, idle sign-out and the privacy re-check. Today: the simulated session picker persists the chosen customer/staff in `localStorage` with no sign-out; staff ids outside the directory are accepted by the simulated identity (documented limit in FEAT-ORBIT); non-owner agents may act on a colleague's case (FND-0026, BL-016).

## Dependencies and consumers
Depends on: FEAT-ORBIT (identity boundary, staff directory, DEC-0003 labeled simulation), FEAT-CASE (permission enforcement inside `CasesService`), FEAT-CHAT and FEAT-STAFF shells (links, pages, sign-out). Used by: the host shell (route link), the staff workspace (recovery page).

## Where to work
- Plans: `../../phases/PH-7.md`, `../../phases/PH-7.1.md`.
- Recovery route: shared schema → migration → service/controllers under `apps/api/src/access/` → web form and staff page → tests → smoke observation.

## Important failure and permission behavior
A recovery request must answer identically for known and unknown contacts and never reveal whether an account exists; the public endpoint is rate-limited (429) and validates input (400); staff endpoints are staff-only.

## Decisions and assumptions
DEC-0003 (simulation labeled), DEC-0012 (reassignment authority), DEC-0017 (lock rule); DEC-0028 pending (role model, PH-7.2). Assumption: Orbit's verification process is outside this system (BL-002); the "forwarded" outcome is a record of a hand-off, not the hand-off itself.

## Verification and change checklist
Any change → `npm run gate`; new endpoints → e2e negatives for identity, ownership and input; UI → web tests and a smoke observation. Last scoped evidence: none yet.
