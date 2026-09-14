# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-13
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-2.md`; base checkpoint: PH-2.1 commit on `main` (child of `b1cc4c6`)

| Field | Value |
|---|---|
| Active objective / feature | PH-2 conversation reliability (OBJ-SUP-01, OBJ-SUP-04; FEAT-CHAT, FEAT-STAFF, FEAT-CASE). Live updates delivered (73–129 ms end to end, ADR-0004). |
| Active phase / subphase | PH-2 `ACTIVE`. PH-2.1 `APPROVED` (2026-09-13). PH-2.2 `PLANNED`, next. No subphase active. |
| Audit | Cycle 1: 1/3 first-time phase approvals (PH-1); not due; no inherited debt. |
| Blocking decisions / dependencies | None. |
| Integration / CI / release | Candidate: PH-2.1 commit on `main`. Local: `npm run build` exit 0, `npm run verify` exit 0, browser smoke exit 0 (`docs/evidence/PH-2.1-verification.md`). CI: PH-1.5 `b1cc4c6` — see its evidence; PH-2.1 commit awaiting corroboration. Release: none, not authorized. |
| Context route | `CONTEXT_INDEX.md` → `docs/features/FEAT-CHAT/CONTEXT.md`, `docs/features/FEAT-STAFF/CONTEXT.md`; phase `docs/phases/PH-2.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Start PH-2.2 — delivery and unread states: read markers (`customer_last_read_at`, `staff_last_read_at` on the case, `POST …/read` endpoints), `unreadCount` in summaries, unread badges in customer lists and staff queues, a "new reply" cue in open conversations, a visible connection indicator ("Reconectando…") driven by the stream status, and a pending-message queue that retries automatically on reconnect. Create `docs/phases/PH-2.2.md` (pending) and set it `ACTIVE` in `docs/phases/PH-2.md`.
Why now: with live delivery in place, the next trust gap is knowing what is new and what actually got through (context §4.3: "makes new/unread replies visible and distinguishes a message that could not be sent from one successfully received").
Preconditions: `npm run verify` passes on HEAD; tree clean or attributable; CI green on HEAD or its failure diagnosed first; ledger 1/3.
Evidence/read first: `docs/features/FEAT-CHAT/CONTEXT.md` and `docs/features/FEAT-CASE/CONTEXT.md` (gaps), `docs/phases/PH-2.md` scenarios (3) and (4), `apps/web/src/lib/sse.ts` (status callbacks).
If preconditions fail: CI red → diagnose and fix first. Unknown local changes → attribute and preserve (§4.3).
