# PH-2.1 — Live updates
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-2.md`
Feature context: `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Replace "refresh every 5 s" with server-pushed events: when a message is created or a case changes, open conversations and staff queues update within a couple of seconds; when the connection drops, clients say so, reconnect with backoff and resync so nothing is missed. Prerequisite: PH-1. Out of scope: read markers/unread counts (PH-2.2), multi-instance fan-out (PH-8).

## Affected boundaries and implementation approach
- `packages/shared/src/stream.ts`: `CaseStreamEvent` union (`case.updated` with summary, `message.created` with message, `heartbeat`).
- `apps/api/src/events/`: `CaseEventBus` (RxJS Subject, in-process), `CaseStreamService` building per-audience observables with a heartbeat; `CasesService` publishes after each committed write.
- SSE endpoints: `GET /api/support/cases/:id/stream` (ownership checked first; internal-visibility messages filtered out — RULE-SUP-04) and `GET /api/staff/stream` (all events). Nest `@Sse()`.
- `apps/web/src/lib/sse.ts`: fetch-based SSE reader (headers allowed, unlike `EventSource`), parser, reconnect with capped exponential backoff, status callbacks. Consumers resync (`refresh()`) on every (re)connect; polling stays as a safety net at 60 s while connected and 5 s while not.
- Web wiring: `CaseConversation` applies `message.created` immediately and refreshes on `case.updated`; `StaffWorkspace` subscribes once and fans out to the queue (refresh token) and the open case (case signal).

## Required behavior, failures and acceptance evidence
- A staff reply reaches an open customer conversation without reload (and vice versa) — browser smoke asserts arrival well under the old 5 s poll.
- Customer stream never emits an internal note (e2e negative); a customer cannot open another customer's stream (404 before any byte is sent).
- Heartbeats keep idle connections alive; client disconnect ends the server subscription.
- Reconnect after a dropped stream triggers a resync (unit test on the client; e2e covers server side).
Acceptance evidence: `../evidence/PH-2.1-verification.md`.

## Work performed and important decisions
ADR-0004 (SSE over fetch streaming, in-process bus, resync on connect). Endpoints: `GET /api/support/cases/:id/stream`, `GET /api/staff/cases/stream` (declared before `:id`). Heartbeat 15 s (`SUPPORT_SSE_HEARTBEAT_MS`). Clients: `apps/web/src/lib/sse.ts`; `CaseConversation` applies pushed messages and bumps its request counter so a stale poll cannot undo them; `StaffWorkspace` holds one stream and fans out to queue and case view; safety-net polling 60 s while connected, 5–10 s otherwise. Smoke asserts a 3 s live-delivery budget in both directions (measured 73 ms and 129 ms).

## Verification, limitations and context updates
Evidence: `../evidence/PH-2.1-verification.md`. Limitations: single API instance (PH-8 adds a shared channel before scaling); reconnection exercised in unit tests, not yet in Chromium; production proxy behavior unknown until PH-8.
Context updated: `PH-2.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../runbooks/VERIFICATION.md`, `../decisions/DECISION_LOG.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
