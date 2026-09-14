# PH-7 — Access recovery and privacy hardening
Type: PHASE CONTEXT
Status: APPROVED
Objective / Feature IDs: OBJ-SUP-04, OBJ-SUP-01; FEAT-ACCESS (new), FEAT-ORBIT, FEAT-CHAT, FEAT-STAFF, FEAT-CASE
Cycle: 3 (count in the `ROADMAP.md` ledger; this phase's approval counts first)

## Outcome and why now
Someone who cannot sign in finds a visible "Não consigo acessar minha conta" route and gets appropriate help without obtaining any private account history before verification (`PROJECT_CONTEXT.md` §4.5, §14 item 8); staff act within a clear role model (§5.1 "one person may perform several roles… access rights must still be clear", RULE-SUP-02, BL-016); signing out on a shared device leaves nothing of the previous customer on screen or in the browser (§10.2, RULE-SUP-01); and the shared-incident and consultation paths are re-checked so restricted information never reaches a customer (RULE-SUP-04). Why now: Cycle Audit 2 closed with PH-1..PH-6 approved; PH-7 is the next `PLANNED` phase, depends only on PH-3 and PH-4, and §4.5 / §14 item 8 are the last customer-facing situations without an implementation.

## Scope, non-goals and dependencies
In scope: (1) an unauthenticated recovery request — an unverified contact (e-mail or phone), a short description, a reference the person can quote — stored apart from cases, visible to staff in a dedicated "Recuperação de acesso" view with outcomes "encaminhado ao processo de verificação do Orbit" (simulated, labeled) or "encerrado", never linked to an account by the support system itself, with a light abuse limit; (2) the role model: a permission table in `packages/shared` enforced by the API (owner or supervisor/admin for status, resolution, closure, consultations, priority/category; anyone may reply and becomes responsible only when the case is unowned; supervisors/admins may reassign — DEC-0012) and mirrored by the workspace; staff identities validated against the directory (unknown ids refused, the directory's role wins over the header); (3) "Sair" for customer and staff (simulated sessions): clears the remembered selection, pending buffers and in-memory state, closes streams, and shows a neutral "choose who you are" screen — plus an idle sign-out on the customer host; (4) a privacy re-check of incident broadcasts, consultations and attachments across roles, recorded as evidence.
Non-goals: real authentication or Orbit's verification process (BL-001/BL-002 — the forwarding is a labeled simulation), identity documents in chat (§10.2), role-gated unmasking (masking stays default), staff notifications, retention policies (PH-8).
Dependencies: PH-3 (lifecycle, incidents), PH-4 (identity boundary, staff directory). Uses DEC-0003 (labeled simulation), DEC-0012 (reassignment authority), DEC-0015 (customer projection), DEC-0017 (lock rule).

## Product rules and acceptance scenarios
- RULE-SUP-01 / §4.5: a recovery request reveals nothing — the response carries only the reference and the next step; knowing an e-mail, id or reference returns no account or case data; staff see the request's own fields only.
- §4.5: support never asks for a password, 2FA code or recovery secret; the form says so and the copy directs to Orbit's verification process.
- RULE-SUP-02: the responsible person is clear; an action outside a role is refused (403) with an honest message in the workspace.
- RULE-SUP-04 / §10.2: sign-out on a shared device leaves no conversation, notification, record or draft of the previous customer; incident notes and consultations never reach customers.
Scenarios: (a) a visitor with no session uses "Não consigo acessar minha conta", sends a contact and a description, and receives "REC-000001" with the next step; the same contact cannot flood the route; (b) staff see the request in "Recuperação de acesso", mark it forwarded (labeled simulation) and the outcome is attributable; (c) an agent tries to resolve a colleague's case → 403 `not_case_owner` and the workspace explains it; a supervisor may; an unknown staff id → 401; (d) after "Sair" on the host, the next person sees no case, notification, record or draft of the previous customer even after reload; the idle timeout signs out too; (e) an incident note broadcast to linked cases is absent from every customer surface and stream (re-check with the new role model).

## Important uncertainties and decision references
- Orbit's real recovery/verification process is unknown (BL-002): the route records and forwards; nothing here verifies identity.
- Role model decided in PH-7.2 (BL-016 → DEC-0029).
- Abuse limits and the idle timeout are working defaults (§13.1 spirit) recorded in the decision log.

## Planned subphases, adjusted as evidence arrives
| ID | Block | Status |
|---|---|---|
| PH-7.1 | "Não consigo acessar minha conta": shared contracts, `access_recovery_requests` (migration `0016`), public endpoint with abuse limit, staff view and outcomes, host link and form — `PH-7.1.md`, approved 2026-09-14 | APPROVED |
| PH-7.2 | Roles and permissions: permission table, API enforcement, directory-validated staff identity, workspace mirroring, BL-016 decision — `PH-7.2.md`, approved 2026-09-14 | APPROVED |
| PH-7.3 | Shared-device sign-out (customer and staff), idle sign-out, privacy re-check of incidents/consultations/attachments; phase closure — `PH-7.3.md`, approved 2026-09-14 | APPROVED |

## Verification and operational readiness
Per subphase: api unit and e2e tests (no data in recovery responses, abuse limit, permission matrix negatives per role and ownership, unknown staff id), web tests (form, sign-out clearing state, disabled actions with reasons), browser smoke extended with the recovery route and the sign-out. `npm run gate` for every commit; `npm run verify:full` and the smoke on the phase candidate.

## Completion evidence, findings and context updated
Approved 2026-09-14 — `../evidence/PH-7-phase-approval.md`: scenarios (a)–(e) mapped to executed tests and browser observations on the phase candidate (screenshots `../evidence/screenshots/ph-7/`). Subphase evidence: `../evidence/PH-7.1-verification.md`, `../evidence/PH-7.2-verification.md`, `../evidence/PH-7.3-verification.md`.
Findings: FND-0057 (`check-context` skipped missing paths because of a `git check-ignore` quirk — fixed in PH-7.2). No open findings.
Context updated: FEAT-ACCESS (new) / FEAT-ORBIT / FEAT-CASE / FEAT-CHAT / FEAT-STAFF contexts; `ROADMAP.md` ledger (cycle 3, 1/3); `../../CURRENT_STATE.md`; DEC-0028–DEC-0030; BL-016 closed.
Simulated identity, sessions, roles and the hand-off to Orbit's verification process (DEC-0003, DEC-0028).
