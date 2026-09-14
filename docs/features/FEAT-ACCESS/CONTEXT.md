# Access recovery and privacy
Type: FEATURE CONTEXT
Feature ID: FEAT-ACCESS
Lifecycle: PARTIAL (recovery route delivered in PH-7.1; roles and sign-out pending)
Freshness: CURRENT
Verified against: the PH-7.1 commit
Verified on: 2026-09-14
Scope: `packages/shared/src/access.ts`, `apps/api/src/access/` (service, controllers, module), `apps/api/drizzle/0016_*`, `apps/web/src/features/access/`, staff page `apps/web/src/features/staff/AccessRecoveryPanel.tsx`; planned: sign-out in `apps/web/src/lib/simulated-session.ts` and the shells (PH-7.3), permission table in `packages/shared/src/identity.ts` (PH-7.2)

## User outcome and applicable product rules
Someone unable to sign in can ask for help through a visible route without obtaining any private account history before verification (`PROJECT_CONTEXT.md` §4.5, §14 item 8); staff act within clear roles (§5.1, RULE-SUP-02); signing out on a shared device leaves nothing of the previous customer (§10.2). Rules: RULE-SUP-01 (knowing an id is insufficient), RULE-SUP-04 (restricted information never reaches customers), RULE-SUP-02 (responsibility is clear).

## Current behavior and known gaps
Recovery route (PH-7.1, DEC-0028): the host topbar link "Não consigo acessar minha conta" opens a form that needs no session — an e-mail or phone (unverified) and a description; `POST /api/public/access-recovery` (no identity read or required) answers `{ reference "REC-000001", receivedAt, nextStep: "orbit_verification", delivery: "simulated" }` and nothing else, identically for known and unknown contacts; retries with the same `clientRequestId` return the same reference; abuse limits 3 per contact per hour and 30 per API instance per 10 minutes (429 with `retryAfterSeconds`, shown in minutes). Staff page "Recuperação de acesso": list by status, the raw contact (staff must reach the person), one attributable outcome "Encaminhar ao processo de verificação" (labeled simulation — a record of the hand-off, not a call to Orbit) or "Encerrar", with an optional note. The table `access_recovery_requests` has no link to cases or customer ids.
Planned: PH-7.2 roles and permissions (BL-016 → DEC-0029), PH-7.3 shared-device sign-out, idle sign-out and the privacy re-check. Today: the simulated session picker persists the chosen customer/staff in `localStorage` with no sign-out; staff ids outside the directory are accepted by the simulated identity (documented limit in FEAT-ORBIT); non-owner agents may act on a colleague's case (FND-0026, BL-016).

## Dependencies and consumers
Depends on: FEAT-ORBIT (identity boundary, staff directory, DEC-0003 labeled simulation), FEAT-CASE (permission enforcement inside `CasesService`), FEAT-CHAT and FEAT-STAFF shells (links, pages, sign-out). Used by: the host shell (route link), the staff workspace (recovery page).

## Where to work
- Plans: `../../phases/PH-7.md`, `../../phases/PH-7.1.md`.
- Recovery route: `packages/shared/src/access.ts` → `apps/api/src/access/access-recovery.service.ts` (limits, idempotency, outcomes) and `access.controllers.ts` → `apps/web/src/features/access/AccessRecoveryForm.tsx` (host) and `apps/web/src/features/staff/AccessRecoveryPanel.tsx` → tests `access-recovery.service.spec.ts`, e2e PH-7.1, `AccessRecoveryForm.test.tsx`; smoke observations `access-recovery`, `access-recovery-staff`.

## Important failure and permission behavior
A recovery request answers identically for known and unknown contacts and never reveals whether an account exists (e2e asserts the same shape); the public endpoint is rate-limited (429) and validates input (400, NUL refused); staff endpoints are staff-only (401/403); a second outcome on a handled request → 409.

## Decisions and assumptions
DEC-0003 (simulation labeled), DEC-0012 (reassignment authority), DEC-0017 (lock rule), DEC-0028 (recovery route: unverified contact, no linkage, working abuse limits, simulated hand-off); DEC-0029 pending (role model, PH-7.2). Assumption: Orbit's verification process is outside this system (BL-002); the "forwarded" outcome is a record of a hand-off, not the hand-off itself.

## Verification and change checklist
Any change → `npm run gate`; new endpoints → e2e negatives for identity, ownership and input; UI → web tests and a smoke observation. Last scoped evidence: `docs/evidence/PH-7.1-verification.md`.
