# PH-7.1 — "Não consigo acessar minha conta"
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-7.md`
Feature context: `../features/FEAT-ACCESS/CONTEXT.md`, `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`

## Objective, prerequisites and scope
A person who cannot sign in finds the route from the host without any session, leaves an unverified contact and a description, and gets a reference and the honest next step; staff see and handle these requests in their own view; nothing about any account is revealed at any point (`PROJECT_CONTEXT.md` §4.5, §14 item 8, RULE-SUP-01). Prerequisite: PH-4 identity boundary. Out of scope: verification of the person (Orbit's process, simulated and labeled), linking a request to an account, the role model (PH-7.2), sign-out (PH-7.3).

## Affected boundaries and implementation approach
- Contracts (`packages/shared/src/access.ts`): `accessRecoveryRequestSchema` (input: `contact` 5–120 chars — e-mail or phone-like, `description` 10–1000 chars, `clientRequestId` optional for idempotent retry), `AccessRecoveryReceipt { reference, receivedAt, nextStep }`, `AccessRecoveryRequest` (staff view: id, reference, contact, description, status `received | forwarded | closed`, createdAt, handledById/Name, handledAt, note), `ACCESS_RECOVERY_STATUSES`, `formatRecoveryReference` ("REC-000001").
- Schema migration `0016`: `access_recovery_requests` (reference_number identity, contact, contact_hash, description, status, client_request_id unique per contact hash, handled_by_id/name, handled_at, note, created_at) with indexes on status/created_at and contact_hash/created_at.
- API (`apps/api/src/access/`): `AccessRecoveryService` (create with an abuse limit — at most 3 requests per contact per hour and 30 per instance per 10 minutes, 429 `too_many_requests`; list/handle for staff with attribution; never queries cases or Orbit); `PublicAccessController` `POST /api/public/access-recovery` (no identity guard; a customer or staff header is ignored, not required); `StaffAccessController` `GET /api/staff/access-recovery?status=`, `POST /api/staff/access-recovery/:id/handle { outcome: forwarded | closed, note? }` (staff; the "forwarded" outcome is labeled as a simulated hand-off to Orbit's verification process).
- Web: host topbar link "Não consigo acessar minha conta" (always visible, no identity needed) opening `apps/web/src/features/access/AccessRecoveryForm.tsx` (contact, description, the "never ask for password/2FA" note, the receipt with the reference and next step, honest error/429 states); staff workspace page "Recuperação de acesso" (`apps/web/src/features/staff/AccessRecoveryPanel.tsx`) with the list by status and the two outcomes; copy in `pt-BR.ts` under `access`.

## Required behavior, failures and acceptance evidence
- The receipt contains only the reference, the time and the next step; no lookup of accounts or cases happens (unit: the service has no dependency on `CasesService` or `OrbitRecordsPort`; e2e: a contact equal to a known customer's e-mail returns the same shape as an unknown one).
- Repeated sends with the same `clientRequestId` and contact return the same reference (RULE-SUP-03); the abuse limit answers 429 with `retryAfterSeconds`.
- Staff outcomes are attributable (`handledBy…`), the list is staff-only (customer → 403, no identity → 401), and the public endpoint refuses invalid or NUL input (400).
- The form is reachable without a session and never asks for secrets; the copy points to Orbit's verification process and says the hand-off is simulated in this version.
Acceptance evidence: `../evidence/PH-7.1-verification.md`.

## Work performed and important decisions
- Shared `access.ts`: `accessRecoveryInputSchema` (e-mail- or phone-like contact, 10–1000-char description, optional `clientRequestId`), `AccessRecoveryReceipt`, `AccessRecoveryRequest`, outcomes and statuses, `ACCESS_RECOVERY_LIMITS`, `formatRecoveryReference`.
- Table `access_recovery_requests` (migration `0016`): reference identity, contact and its sha256 hash, description, status, client request id (unique per contact hash), handling attribution. No foreign key and no customer id by design.
- API module `apps/api/src/access/` apart from `CasesModule`: `AccessRecoveryService` (idempotent create, 3 per contact per hour + 30 per instance per 10 minutes → 429, list by status, one attributable outcome), `PublicAccessController` (`POST /api/public/access-recovery`, no guard) and `StaffAccessController` (`GET /api/staff/access-recovery?status=`, `POST …/:id/handle`).
- Web: `AccessRecoveryForm` opened from the host topbar link (no session needed; the form replaces the trading placeholder while open), `publicApi.requestAccessRecovery`; staff page "Recuperação de acesso" (`AccessRecoveryPanel`) with filter, note and the two outcomes; copy under `access` and `staff.accessRecovery`.
- DEC-0028: the recovery route stores an unverified contact, never links it to an account or a case, answers identically for known and unknown contacts, bounds abuse with working defaults, and records "forwarded" as a labeled simulation of the hand-off to Orbit's verification process.

## Verification, limitations and context updates
Evidence: `../evidence/PH-7.1-verification.md`. Limitations: the hand-off is a record, not a call to Orbit (BL-002); the burst limit is per API instance (PH-8 topology); staff see the raw contact because they must reach the person — role-based masking of contacts is not in scope.
Context updated: `PH-7.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `../features/FEAT-ACCESS/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../runbooks/VERIFICATION.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
