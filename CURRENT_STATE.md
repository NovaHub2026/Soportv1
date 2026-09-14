# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-13
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-2.md`; base checkpoint: PH-2.3 commit on `main` (child of `c628d8b`)

| Field | Value |
|---|---|
| Active objective / feature | PH-2 conversation reliability (OBJ-SUP-01, OBJ-SUP-04; FEAT-CHAT, FEAT-STAFF, FEAT-CASE). Live updates, unread/read states, offline recovery and attachments delivered; phase closure pending. |
| Active phase / subphase | PH-2 `ACTIVE`. PH-2.1, PH-2.2, PH-2.3 `APPROVED` (2026-09-13). PH-2.4 `PLANNED`, next and last. No subphase active. |
| Audit | Cycle 1: 1/3 first-time phase approvals (PH-1); not due; no inherited debt. PH-2 approval will make it 2/3. |
| Blocking decisions / dependencies | None. |
| Integration / CI / release | Candidate: PH-2.3 commit on `main`. Local: `npm run build` exit 0, `npm run verify` exit 0, browser smoke exit 0 (`docs/evidence/PH-2.3-verification.md`). CI: PH-2.2 `c628d8b` — see its evidence; PH-2.3 commit awaiting corroboration. Release: none, not authorized. |
| Context route | `CONTEXT_INDEX.md` → `docs/features/FEAT-CHAT/CONTEXT.md`, `docs/features/FEAT-CASE/CONTEXT.md`; phase `docs/phases/PH-2.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Start PH-2.4 — reliability evidence and phase closure: (1) add the missing automated reliability tests — server: idempotent retry under concurrency (two parallel sends with the same `clientMessageId` store one message), stream resync after a dropped connection (client resubscribes and re-reads); web: reconnect watchdog already covered — add a duplicate-suppression test when a pushed message arrives after the same message was appended optimistically; (2) run the browser smoke once more on the phase candidate; (3) refresh the three feature contexts' freshness and gaps, write `docs/evidence/PH-2-phase-approval.md`, set PH-2 `APPROVED`, ledger 2/3; (4) `npm run build` + `npm run verify`. Create `docs/phases/PH-2.4.md` (pending) and set it `ACTIVE` in `docs/phases/PH-2.md`.
Why now: every PH-2 capability is in place; §6.3 requires the integrated journey and the phase's acceptance scenarios (1)–(5) in `docs/phases/PH-2.md` demonstrated on one candidate before approval.
Preconditions: `npm run verify` passes on HEAD; tree clean or attributable; CI green on HEAD or its failure diagnosed first; ledger 1/3.
Evidence/read first: `docs/phases/PH-2.md` (scenarios), `docs/evidence/PH-2.1-verification.md` … `PH-2.3-verification.md`, `apps/api/src/cases/cases.service.ts` (idempotency path), `apps/web/src/lib/sse.ts`.
If preconditions fail: CI red → diagnose and fix first. Unknown local changes → attribute and preserve (§4.3).
