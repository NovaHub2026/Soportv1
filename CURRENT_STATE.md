# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-13
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-3.md`; base checkpoint: PH-3.2 commit on `main` (child of `3fc99b0`)

| Field | Value |
|---|---|
| Active objective / feature | PH-3 case lifecycle and staff collaboration (OBJ-SUP-03; FEAT-CASE, FEAT-STAFF, FEAT-CHAT). Transitions, resolution, internal notes and consultations delivered. |
| Active phase / subphase | PH-3 `ACTIVE`. PH-3.1, PH-3.2 `APPROVED` (2026-09-13). PH-3.3 `PLANNED`, next. No subphase active. |
| Audit | Cycle 1: 2/3 first-time phase approvals (PH-1, PH-2); not due. PH-3's approval makes it 3/3 → Cycle Audit due immediately after. |
| Blocking decisions / dependencies | None. |
| Integration / CI / release | Candidate: PH-3.2 commit on `main`. Local: `npm run build` exit 0, `npm run verify` exit 0, browser smoke exit 0 (`docs/evidence/PH-3.2-verification.md`). CI: PH-3.1 `3fc99b0` — see its evidence; PH-3.2 commit awaiting corroboration. Release: none, not authorized. |
| Context route | `CONTEXT_INDEX.md` → `docs/features/FEAT-CASE/CONTEXT.md`, `docs/features/FEAT-STAFF/CONTEXT.md`; phase `docs/phases/PH-3.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Start PH-3.3 — assignment and attributes: `POST /api/staff/cases/:id/assign {agentId | null}` (transfer to another agent or release to the queue; owner may transfer their own case, supervisors/admins may reassign any; history, age and pending consultations preserved; `case_assigned` event with previous owner), `PATCH /api/staff/cases/:id {priority?, category?}` with `priority_changed` / `category_changed` events; simulated staff directory for the transfer picker (the three simulated agents); staff UI: "Transferir" / "Devolver à fila" and priority/category selects in the header; queue shows the new owner live. Role check: first use of `StaffActor.role` (agent vs supervisor/admin) — add a small `requireRole` helper and its negative test. Create `docs/phases/PH-3.3.md` (pending) and set it `ACTIVE` in `docs/phases/PH-3.md`.
Why now: RULE-SUP-02 ("transfer preserves follow-through", "when someone becomes unavailable their cases are reassigned") and context §5.2/§5.4 priority handling are the remaining ownership gaps before closure and follow-ups.
Preconditions: `npm run verify` passes on HEAD; tree clean or attributable; CI green on HEAD or its failure diagnosed first; ledger 2/3.
Evidence/read first: `PROJECT_CONTEXT.md` §5.2, §5.4; `docs/features/FEAT-CASE/CONTEXT.md`; `apps/api/src/cases/cases.service.ts` (`assign`, `takeCase`), `apps/api/src/identity/guards.ts`.
If preconditions fail: CI red → diagnose and fix first. Unknown local changes → attribute and preserve (§4.3).
