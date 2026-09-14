# PH-2 — Phase approval evidence
Type: VERIFICATION EVIDENCE
Work item: PH-2 — Conversation reliability and continuity (phase-level acceptance, `GOVERNANCE.md` §6.3)
Recorded on: 2026-09-13 (final runs 2026-09-14 01:33–01:40 UTC)
Revision: `88ee96c` plus the PH-2.4 working tree (the PH-2.4 commit on `main` is the phase candidate).
Environment: as in `PH-2.3-verification.md`.

## Phase scenarios (from `docs/phases/PH-2.md`) and evidence
| # | Scenario | Evidence | Category |
|---|---|---|---|
| 1 | Staff reply appears in the open customer conversation within ~2 s without reload, and vice versa | Browser smoke on the candidate: reply-live and follow-up-live observations (measured tens of ms in every PH-2 run: 73/129, 66/135, 57/169, 60 ms…); stream e2e tests | OBSERVED + EXECUTED |
| 2 | Stream drops → UI shows reconnecting, reconnects and resyncs, nothing missing or duplicated | `sse.test.ts` (reconnect after server end, stale watchdog); `CaseConversation.test.tsx` (resync GET on connect, duplicate push rendered once); smoke offline/online cycle with exactly-once delivery | EXECUTED + OBSERVED |
| 3 | A message sent while offline is marked failed/pending and delivered once on retry | Smoke: "Não enviada" while offline, resent automatically after reconnect, present once on both sides (`10-offline-failed.png`); web test for `online`-event retry with the same `clientMessageId`; API concurrency test (FND-0005) | OBSERVED + EXECUTED |
| 4 | Unread replies are visible in lists and the conversation | Smoke: staff queue badge "1 nova do cliente" cleared on open; home badge "1 nova mensagem" live (`11-home-unread.png`); read receipt "Última resposta lida pelo cliente"; unit/e2e for counts and markers incl. internal-note exclusion | OBSERVED + EXECUTED |
| 5 | Image/PDF attached by the customer opens for staff and the owner, not for another customer; a 20 MB file or an `.exe` is refused clearly | e2e: 415 for executable bytes, 413 over 10 MB, 404 for another customer, staff upload invisible to the customer until public; smoke: PNG thumbnail on both sides, disguised executable refused (`12-staff-attachment.png`) | EXECUTED + OBSERVED |

## Rules
RULE-SUP-03: exactly-once storage under retries and races (unit, e2e, smoke). RULE-SUP-04: customer streams and unread counts exclude internal notes (e2e negative, unit negative). RULE-SUP-06: history and attachments reachable from the case (detail endpoints, smoke reload). RULE-SUP-07 / §10.2: attachment states shown honestly (web tests, smoke).

## Delivery states (§6.3)
Implemented and locally verified: yes. Integrated: `main`. CI verified: the PH-2.4 commit's run is recorded in `PH-2.4-verification.md`. Released: no.

## Uses simulation
All demonstrations use simulated identity and no Orbit records (DEC-0003).

## Findings during the phase
FND-0002 (PH-1.4, carried context), FND-0003 (wrong stream path), FND-0004 (offline stream looked connected), FND-0005 (concurrent retry 500) — all fixed and re-verified in their subphases. None open. Backlog: BL-009 (orphan attachments), BL-010 (attachments on the first message).

## Approval
PH-2 `APPROVED` on 2026-09-13 by the Agent (evidence-based, not a human review). Ledger: cycle 1, 2/3 — one more first-time phase approval triggers the Cycle Audit (§6.4).
