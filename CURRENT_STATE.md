# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-13
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-1.md`; base checkpoint: PH-1.5 commit on `main` (child of `b5d3890`)

| Field | Value |
|---|---|
| Active objective / feature | PH-1 delivered: a customer request becomes a persistent case that staff see, take and answer, observed end to end in both UIs (simulated identity, no Orbit records). Next objective: OBJ-SUP-01/-04 reliability — PH-2. |
| Active phase / subphase | None active. PH-1 `APPROVED` 2026-09-13 (PH-1.1–1.5 approved). PH-2 `PLANNED`, next. |
| Audit | Cycle 1: 1/3 first-time phase approvals (PH-1, 2026-09-13); not due; no inherited debt. |
| Blocking decisions / dependencies | None. Real-time transport choice (SSE vs WebSocket) is decided at the start of PH-2.1 (ADR: architecture/contract). |
| Integration / CI / release | Candidate: PH-1.5 commit on `main`. Local: `npm run build` exit 0, `npm run verify` exit 0, browser smoke exit 0 (`docs/evidence/PH-1.5-verification.md`, `docs/evidence/PH-1-phase-approval.md`). CI: PH-1.4 `b5d3890` — see its evidence; PH-1.5 commit awaiting corroboration. Release: none, not authorized. |
| Context route | `CONTEXT_INDEX.md` → feature contexts (FEAT-CASE, FEAT-CHAT, FEAT-STAFF, FEAT-ORBIT are `CURRENT`); phases in `docs/phases/`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Start PH-2 — create the PH-2 phase document under `docs/phases/` (pending; outcome, rules RULE-SUP-03/-06, acceptance scenarios from context §4.3–4.4 and §14 item 6, planned subphases) and set it `ACTIVE`; then PH-2.1 = live updates (replace polling on conversation and queues with a server-pushed channel plus fallback), recorded as an ADR for the transport. Later subphases: send/unread/connection states with retry-on-reconnect; image/PDF attachments with protected access (context §13.1 limits); reliability evidence (disconnect/retry/transfer without loss).
Why now: PH-1 is approved; the product's next most valuable gap is trustworthy delivery — customers must see replies without reloading and never lose messages (RULE-SUP-03).
Preconditions: `npm run verify` passes on HEAD; tree clean or attributable; CI green on HEAD or its failure diagnosed first; audit ledger 1/3 (no audit due).
Evidence/read first: `docs/features/FEAT-CHAT/CONTEXT.md`, `docs/features/FEAT-CASE/CONTEXT.md` (gaps sections); `PROJECT_CONTEXT.md` §4.3, §4.4, §7.4, §10.2 (attachments), §13.1; `docs/phases/ROADMAP.md` PH-2 row.
If preconditions fail: CI red → diagnose and fix first. Unknown local changes → attribute and preserve (§4.3).
