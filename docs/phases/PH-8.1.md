# PH-8.1 — Hardening and carried debt
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-8.md`
Feature context: `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`

## Objective, prerequisites and scope
Close the hardening every audit deferred to PH-8 (BL-012) and the product debt carried from PH-7 (BL-021, BL-024) so a deployment does not start with known exposures. Prerequisite: PH-7. Out of scope: a shared rate-limit store (one API instance until PH-8.3 decides the topology), real staff accounts.

## Affected boundaries and implementation approach
- `SlidingWindowLimiter` (`apps/api/src/common/rate-limit.ts`): in-memory per-key window with a 429 helper; uploads use it (30 per identity per 10 minutes, `ATTACHMENT_LIMITS.maxUploadsPer10Minutes`).
- `CaseStreamService.limited(key, stream)`: counts open streams per identity, refuses beyond `SUPPORT_SSE_MAX_PER_IDENTITY` (default 8) with 429 before any byte, releases on completion/disconnect; the staff stream is keyed by the staff id.
- `configureApp`: `helmet()` defaults and no `X-Powered-By`; `finishApp`: JSON 404 for paths outside `/api` (Express answered HTML). `main.ts`: loopback bind by default, `SUPPORT_BIND` for deployments, a loud warning when bound to a network without `NODE_ENV=production`.
- BL-021: `support_cases.waiting_internal_since` (migration `0017`) set on entering `waiting_internal` (status change or consultation request); `CaseSummary.waitingInternalSince` (staff-only, stripped from customer surfaces); queue label "Aguardando a equipe há …"; supervision overview `waitingInternal { count, oldestSince }` and the overdue list includes waiting-for-team cases older than the threshold.
- BL-024 (partial): focus moves to the panel title after "Voltar"; duration units come from the dictionary (`units`, `formatMinutes`). Carried: real tab semantics for the queue, raw number fields in the settings form, system-message copy through the dictionary.

## Required behavior, failures and acceptance evidence
- Ninth concurrent stream of one identity → 429 `too_many_streams`; a released slot is reusable; other identities unaffected. 31st upload in 10 minutes → 429 `too_many_uploads`.
- Every response: `x-content-type-options`, `x-frame-options`, `strict-transport-security`; never `x-powered-by`. `GET /nope` and `GET /api/nope` → JSON 404.
- A `waiting_internal` case older than the threshold appears in the overdue list; customers never see `waitingInternalSince`.
Acceptance evidence: `../evidence/PH-8.1-verification.md`.

## Work performed and important decisions
As planned above. DEC-0031 records the hardening defaults (stream cap 8, uploads 30/10 min, loopback bind, headers, JSON 404) as working values a deployment may tune through environment variables where one exists.

## Verification, limitations and context updates
Evidence: `../evidence/PH-8.1-verification.md`. Limitations: limits are per API instance (a shared store is a PH-8.3 topology decision); the SSE cap is unit-tested (supertest cannot hold open streams); BL-024 partially carried (see BACKLOG).
Context updated: `PH-8.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`, `../runbooks/VERIFICATION.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
