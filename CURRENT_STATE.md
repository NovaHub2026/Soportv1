# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-13
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-3.md`; base checkpoint: PH-3.1 commit on `main` (child of `8a5f211`)

| Field | Value |
|---|---|
| Active objective / feature | PH-3 case lifecycle and staff collaboration (OBJ-SUP-03; FEAT-CASE, FEAT-STAFF, FEAT-CHAT). Status transitions and resolution delivered. |
| Active phase / subphase | PH-3 `ACTIVE`. PH-3.1 `APPROVED` (2026-09-13). PH-3.2 `PLANNED`, next. No subphase active. |
| Audit | Cycle 1: 2/3 first-time phase approvals (PH-1, PH-2); not due. PH-3's approval makes it 3/3 → Cycle Audit due immediately after. |
| Blocking decisions / dependencies | None. |
| Integration / CI / release | Candidate: PH-3.1 commit on `main`. Local: `npm run build` exit 0, `npm run verify` exit 0, browser smoke exit 0 (`docs/evidence/PH-3.1-verification.md`). CI: PH-2.4 `8a5f211` — see its evidence; PH-3.1 commit awaiting corroboration. Release: none, not authorized. |
| Context route | `CONTEXT_INDEX.md` → `docs/features/FEAT-CASE/CONTEXT.md`, `docs/features/FEAT-STAFF/CONTEXT.md`; phase `docs/phases/PH-3.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Start PH-3.2 — internal notes and specialist consultation: `POST /api/staff/cases/:id/notes` (internal-visibility message; never in customer surfaces, streams or counts — RULE-SUP-04), `case_consultations` (team from a fixed list, question, requested by/at, answered by/at, answer) with `POST …/consultations` (sets `waiting_internal`, event `consultation_requested`) and `POST …/consultations/:cid/answer` (event `consultation_answered`, status back to `in_progress`, owner alerted through the stream); staff UI: "Nota interna" toggle in the composer, "Consultar equipe" form, pending-consultation indicator in the header/context and an answer form; customer sees only "Em análise". Create `docs/phases/PH-3.2.md` (pending) and set it `ACTIVE` in `docs/phases/PH-3.md`.
Why now: it is the collaboration half of OBJ-SUP-03 (context §5.3) and the reason "waiting for internal team" exists; RULE-SUP-04 needs its negative tests at the stream and unread layers as well.
Preconditions: `npm run verify` passes on HEAD; tree clean or attributable; CI green on HEAD or its failure diagnosed first; ledger 2/3.
Evidence/read first: `PROJECT_CONTEXT.md` §5.3, §7.2 (reply while waiting for an internal team); `docs/features/FEAT-CASE/CONTEXT.md`; `apps/api/src/cases/cases.service.ts` (`setStatus`, `unreadCounts`, streams filter internal already).
If preconditions fail: CI red → diagnose and fix first. Unknown local changes → attribute and preserve (§4.3).
