# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-13
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-1.md`; base checkpoint: PH-1.3 commit on `main` (child of `fd25efe`)

| Field | Value |
|---|---|
| Active objective / feature | PH-1 end-to-end case skeleton (OBJ-SUP-01, OBJ-SUP-03). API, persistence and the customer panel exist; the staff UI does not. Feature contexts are written in PH-1.5. |
| Active phase / subphase | PH-1 `ACTIVE`. PH-1.1, PH-1.2, PH-1.3 `APPROVED` (2026-09-13). PH-1.4 `PLANNED`, next. No subphase active. |
| Audit | Cycle 1: 0/3 first-time phase approvals; not due; no inherited debt. |
| Blocking decisions / dependencies | None. |
| Integration / CI / release | Candidate: PH-1.3 commit on `main`. Local: `npm run verify` exit 0; browser smoke exit 0 (`docs/evidence/PH-1.3-verification.md`). CI: PH-1.2 commit `fd25efe` — see its evidence; PH-1.3 commit awaiting corroboration. Release: not applicable. |
| Context route | `CONTEXT_INDEX.md` → `docs/phases/PH-1.md` → `docs/phases/PH-1.3.md`; web in `apps/web/src/features/`; API in `apps/api/src/cases/`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Start PH-1.4 — minimal staff workspace in `apps/web` (route `/staff`): unassigned / mine / active queues, case view with full conversation and events, take, reply; simulated staff identity picker. Set PH-1.4 `ACTIVE` in `docs/phases/PH-1.md`, create its subphase document, extend `scripts/ui-smoke.mjs` to drive the staff side instead of calling the API directly.
Why now: the PH-1 outcome needs staff to see, take and answer the case in a real screen; the API for it is verified (PH-1.2) and the customer side is observable (PH-1.3).
Preconditions: `npm run verify` passes on HEAD; tree clean or attributable; CI green on HEAD or its failure diagnosed first.
Evidence/read first: `PROJECT_CONTEXT.md` §5.1–5.3 (workspace areas, daily work, public reply vs internal note); `docs/phases/PH-1.2.md` (staff endpoints); `apps/web/src/features/support/` (patterns to reuse: api client, i18n, CSS module tokens).
If preconditions fail: CI red → diagnose and fix first. Unknown local changes → attribute and preserve (§4.3).
