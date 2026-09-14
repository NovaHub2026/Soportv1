# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-13
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-3.md`; base checkpoint: PH-3.3 commit on `main` (child of `2562555`)

| Field | Value |
|---|---|
| Active objective / feature | PH-3 case lifecycle and staff collaboration (OBJ-SUP-03; FEAT-CASE, FEAT-STAFF, FEAT-CHAT). Transitions, resolution, notes, consultations, transfer/release and attribute edits delivered. |
| Active phase / subphase | PH-3 `ACTIVE`. PH-3.1–3.3 `APPROVED` (2026-09-13). PH-3.4 `PLANNED`, next. No subphase active. |
| Audit | Cycle 1: 2/3 first-time phase approvals (PH-1, PH-2); not due. PH-3's approval makes it 3/3 → Cycle Audit due immediately after. |
| Blocking decisions / dependencies | None. |
| Integration / CI / release | Candidate: PH-3.3 commit on `main`. Local: `npm run build` exit 0, `npm run verify` exit 0, browser smoke exit 0 (`docs/evidence/PH-3.3-verification.md`). CI: PH-3.2 `2562555` — see its evidence; PH-3.3 commit awaiting corroboration. Release: none, not authorized. |
| Context route | `CONTEXT_INDEX.md` → `docs/features/FEAT-CASE/CONTEXT.md`, `docs/features/FEAT-CHAT/CONTEXT.md`; phase `docs/phases/PH-3.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Start PH-3.4 — closure and linked follow-up: `support_cases.parent_case_id` (+ migration), a closure job inside the API (`SUPPORT_FOLLOW_UP_WINDOW_DAYS`, default 7; `SUPPORT_CLOSURE_INTERVAL_MS`) that moves `resolved` cases past the window to `closed` with `case_closed` events and `case.updated` publications, an explicit `POST /api/staff/cases/:id/close` for staff, `POST /api/support/cases/:id/follow-up {message}` creating a linked case (new reference, system message pointing to the previous one, `follow_up_created` event on both), and UI: customer closed notice with "Preciso de mais ajuda" that opens the follow-up; staff link between the cases and "Continuação de SUP-…" in the header. Create `docs/phases/PH-3.4.md` (pending) and set it `ACTIVE` in `docs/phases/PH-3.md`.
Why now: RULE-SUP-06 continuation from a closed case and the honest meaning of "closed" (context §7.3–7.4) are the last lifecycle gaps; the job also needs its operational note before PH-8.
Preconditions: `npm run verify` passes on HEAD; tree clean or attributable; CI green on HEAD or its failure diagnosed first; ledger 2/3.
Evidence/read first: `PROJECT_CONTEXT.md` §7.3–7.4, §13.1; `docs/features/FEAT-CASE/CONTEXT.md`; `apps/api/src/cases/cases.service.ts` (`postCustomerMessage` closed path), `apps/api/src/database/database.module.ts` (module lifecycle for the job).
If preconditions fail: CI red → diagnose and fix first. Unknown local changes → attribute and preserve (§4.3).
