# PH-2 — Conversation reliability and continuity
Type: PHASE CONTEXT
Status: APPROVED
Objective / Feature IDs: OBJ-SUP-01, OBJ-SUP-04; FEAT-CHAT, FEAT-CASE, FEAT-STAFF
Cycle: 1 (see `ROADMAP.md`; PH-1 counted 1/3)

## Outcome and why now
Customers and staff see new messages without reloading, know whether a message was sent or failed, see what is unread, and never lose or duplicate a message across disconnections and retries. Customers can attach images or PDFs that only authorized participants can open. PH-1 proved the journey with a 5 s refresh; a support chat that must be trusted with money-related concerns needs delivery that is prompt, visible and honest (`PROJECT_CONTEXT.md` §4.3, §7.4, §14 item 6).

## Scope, non-goals and dependencies
In scope: server-pushed updates with reconnection and resync; sent / failed / pending states and unread indicators for customer and staff; connection status; retry of pending messages after reconnect; image/PDF attachments (PNG, JPEG, WebP, PDF; 10 MB; 3 per message — context §13.1 working defaults) with a storage port, protected download and visible acceptance state; reliability evidence.
Non-goals: email or in-product notifications outside the conversation (PH-6), lifecycle changes, transfers, notes (PH-3), Orbit record cards (PH-4), horizontal scaling of the event channel (PH-8 decides the multi-instance mechanism).
Dependencies: PH-1 (approved). ADR-0004 (transport).

## Product rules and acceptance scenarios
- RULE-SUP-03: closing the panel, losing connection or retrying never loses accepted messages nor creates visible duplicates.
- RULE-SUP-04: internal notes never reach the customer channel — including the live stream.
- RULE-SUP-06: history and attachments stay reachable from the case.
- RULE-SUP-07 / §10.2: a file that cannot be accepted or is still being checked shows its actual state.
Scenarios: (1) staff reply appears in the open customer conversation within ~2 s without reload, and vice versa; (2) the stream drops → the UI shows reconnecting, reconnects and resyncs, nothing missing or duplicated; (3) a message sent while offline is marked failed/pending and delivered once on retry; (4) unread replies are visible in lists and the conversation; (5) an image and a PDF attached by the customer open for staff and for the owner, not for another customer; a 20 MB file or an `.exe` is refused with a clear message.

## Important uncertainties and decision references
- Transport: SSE over fetch streaming vs WebSocket — ADR-0004 (decided at PH-2.1).
- Streaming through the Next.js rewrite proxy must not buffer; fall back to the API origin for the stream if it does.
- Storage for attachments: local disk behind a port for development; object storage is a PH-8 concern.

## Planned subphases, adjusted as evidence arrives
| ID | Block | Status |
|---|---|---|
| PH-2.1 | Live updates: in-process case event bus, SSE endpoints for customer case stream and staff stream (internal notes filtered for customers), web stream client with reconnect + resync, polling reduced to a safety net — `PH-2.1.md`, approved 2026-09-13 | APPROVED |
| PH-2.2 | Delivery and unread states: read markers, unread counts in lists, connection indicator, pending queue with retry on reconnect, sent/failed semantics documented — `PH-2.2.md`, approved 2026-09-13 | APPROVED |
| PH-2.3 | Attachments: `case_attachments`, storage port (local disk), upload with type/size limits, protected download, acceptance state, UI for customer and staff — `PH-2.3.md`, approved 2026-09-13 | APPROVED |
| PH-2.4 | Reliability evidence and phase closure: disconnect/resync and duplicate-suppression tests, browser smoke for live delivery and attachments, feature contexts updated, phase approval — `PH-2.4.md`, approved 2026-09-13 | APPROVED |

## Verification and operational readiness
Unit + e2e per subphase (including a negative test that the customer stream never carries internal notes); browser smoke extended for live delivery; `npm run verify` and `npm run build` on the phase candidate. Operational note for PH-8: the event bus is in-process — a second API instance needs a shared channel.

## Completion evidence, findings and context updated
Approved 2026-09-13 — `../evidence/PH-2-phase-approval.md`: scenarios (1)–(5) mapped to executed tests and browser observations on the phase candidate (screenshots `../evidence/screenshots/ph-2/`). Subphase evidence: `../evidence/PH-2.1-verification.md` … `../evidence/PH-2.4-verification.md`.
Findings: FND-0003, FND-0004, FND-0005 found and fixed inside the phase; none open. Backlog: BL-009, BL-010.
Context updated: feature contexts FEAT-CASE / FEAT-CHAT / FEAT-STAFF (freshness and behavior), `ROADMAP.md` ledger (cycle 1, 2/3), `../../CURRENT_STATE.md`, `../../CONTEXT_INDEX.md`, `../runbooks/VERIFICATION.md`, ADR-0004, DEC-0009.
Everything runs on simulated identity and no Orbit records (DEC-0003).
