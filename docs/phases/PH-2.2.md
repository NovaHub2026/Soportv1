# PH-2.2 — Delivery and unread states
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-2.md`
Feature context: `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Make delivery visible and honest (`PROJECT_CONTEXT.md` §4.3): customers and staff see what is unread, staff see whether the customer read the latest reply, everyone sees the connection state, and a message typed without connectivity is kept and delivered exactly once when the connection returns (RULE-SUP-03). Prerequisite: PH-2.1 live updates. Out of scope: attachments (PH-2.3), notifications outside the conversation (PH-6).

## Affected boundaries and implementation approach
- Schema migration `0001`: `support_cases.customer_last_read_at`, `staff_last_read_at`.
- Contracts: `CaseSummary` gains `customerLastReadAt`, `staffLastReadAt`, `unreadCount` (viewer-dependent; 0 inside stream events).
- API: `POST /api/support/cases/:id/read`, `POST /api/staff/cases/:id/read` (publish `case.updated`); unread counts computed per list/detail with one grouped query joining the read marker (customers count only public non-customer messages — RULE-SUP-04); `GET /api/support/cases/stream` for all of a customer's cases.
- Web: `UnreadBadge` (count + accessible label) in customer lists and staff queues; `ConnectionIndicator` (text + tone) in the conversation header and staff topbar; conversation and staff case view mark read after load and on incoming messages while the page is visible; staff header shows "Última resposta lida / ainda não lida pelo cliente"; the customer home subscribes to the customer stream to refresh lists live; failed pending messages are resent automatically on `connected` with the same `clientMessageId`.

## Required behavior, failures and acceptance evidence
- A new case shows "1 nova do cliente" in the staff queue; opening it clears the badge (live). A staff reply shows "1 nova mensagem" on the customer home within seconds; opening clears it.
- While the customer has the conversation open, staff see the reply as read within seconds.
- Offline: the customer's message is marked "Não enviada", the indicator leaves "Ao vivo"; on reconnect it is resent once and appears once on both sides.
- Internal notes never count as unread for customers (unit negative); another customer cannot mark a case read (404).
Acceptance evidence: `../evidence/PH-2.2-verification.md`.

## Work performed and important decisions
Read markers are per side (customer / staff) at case level — one responsible agent per case in PH-1..3; per-agent markers can come with supervision (PH-5) if needed. Marking read requires the page to be visible (`document.visibilityState`). Read marks do not touch `updatedAt` and create no history event (not a material action).

Findings fixed in this subphase: FND-0003 (MATERIAL) — the web client subscribed to `/api/support/stream` while the endpoint lives at `/api/support/cases/stream`; the home received no live events until the smoke exposed it and a new e2e reproduced the 404. FND-0004 (MINOR) — an offline SSE connection can look "connected"; recovery now also relies on the browser `online` event, a 15 s retry cadence and a 40 s stale-stream watchdog.

## Verification, limitations and context updates
Evidence: `../evidence/PH-2.2-verification.md`. Limitations: "read" means the conversation was open and visible, not that the text was seen; offline recovery observed with Playwright's network emulation, not a real network drop.
Context updated: `PH-2.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../runbooks/VERIFICATION.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
