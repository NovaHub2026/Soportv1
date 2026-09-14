# ADR-0004 — Live updates over Server-Sent Events read with fetch streaming
Type: DECISION
Status: ACCEPTED
Recorded on: 2026-09-13
Decided on: 2026-09-13
Authority: Agent, delegated (`GOVERNANCE.md` §1.2: architecture, contracts). `PROJECT_CONTEXT.md` §11 leaves real-time transport open.
Related: PH-2.1; RULE-SUP-03, RULE-SUP-04; FEAT-CHAT, FEAT-STAFF; ADR-0002

## Context and evidence
PH-1 refreshed conversations every 5 s and queues every 10 s. The product needs prompt, visible delivery (context §4.3) and a channel that cannot leak internal notes to customers (RULE-SUP-04). Traffic is asymmetric: the server pushes, clients send through ordinary POSTs that already carry idempotency ids. Identity is header-based today (simulated) and will be session-based later (ADR-0002). The web reaches the API through Next.js rewrites.

## Decision and alternatives
Use **Server-Sent Events** produced by NestJS `@Sse()` from an in-process RxJS event bus, read in the browser with **`fetch` + `ReadableStream`** (not `EventSource`, which cannot send headers). One stream per open customer case (ownership verified before the first byte, internal messages filtered) and one staff stream. Clients reconnect with capped exponential backoff and **resync by re-reading** on every (re)connect; polling remains a slow safety net. Heartbeat every 15 s.
Alternatives: (a) WebSockets (`@nestjs/websockets` + socket.io) — bidirectional and heavier; we have no client→server streaming need, and HTTP/SSE passes proxies and the Next rewrite without extra infrastructure. (b) Keep polling at 1–2 s — simpler but noisy and still not "instant"; kept only as fallback. (c) Long polling — more moving parts than SSE for the same result.

## Product effect, costs and risks
Replies appear within about a second; disconnections become visible and recover automatically (RULE-SUP-03). Costs: one open HTTP connection per open conversation/staff page; the in-process bus means a second API instance would not see the first one's events — PH-8 must add a shared channel (PostgreSQL `LISTEN/NOTIFY` or Redis) before running more than one instance. Risk: the Next.js rewrite proxy could buffer the stream; mitigation: verify in the smoke and fall back to a direct API origin for streams if needed.

## Verification, recovery and revisit conditions
PH-2.1 evidence: e2e stream tests (delivery, internal-note filtering, ownership), client parser/reconnect unit tests, browser smoke asserting live arrival. Revisit at PH-8 (multi-instance) or if client→server streaming becomes necessary (e.g. typing indicators are explicitly out of scope today).
