# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-13
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-3.md`; base checkpoint: PH-3.4 commit on `main` (child of `637af01`)

| Field | Value |
|---|---|
| Active objective / feature | PH-3 case lifecycle and staff collaboration (OBJ-SUP-03; FEAT-CASE, FEAT-STAFF, FEAT-CHAT). Transitions, resolution, notes, consultations, transfer, attributes, closure and linked follow-ups delivered. |
| Active phase / subphase | PH-3 `ACTIVE`. PH-3.1–3.4 `APPROVED` (2026-09-13). PH-3.5 `PLANNED`, next and last. No subphase active. |
| Audit | Cycle 1: 2/3 first-time phase approvals (PH-1, PH-2); not due. **PH-3's approval (end of PH-3.5) makes it 3/3: the Cycle Audit must start right after, before any PH-4 work (§6.4).** |
| Blocking decisions / dependencies | None. |
| Integration / CI / release | Candidate: PH-3.4 commit on `main`. Local: `npm run build` exit 0, `npm run verify` exit 0, browser smoke exit 0 (`docs/evidence/PH-3.4-verification.md`). CI: PH-3.3 `637af01` — see its evidence; PH-3.4 commit awaiting corroboration. Release: none, not authorized. |
| Context route | `CONTEXT_INDEX.md` → `docs/features/FEAT-CASE/CONTEXT.md`, `docs/features/FEAT-STAFF/CONTEXT.md`; phase `docs/phases/PH-3.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Start PH-3.5 — shared incidents and phase closure: `incidents` table (id, title, status `open | resolved`, created by, timestamps) and `support_cases.incident_id` (+ migration); staff endpoints `POST /api/staff/incidents`, `GET /api/staff/incidents`, `POST /api/staff/cases/:id/incident {incidentId | null}` (event `incident_linked`), `POST /api/staff/incidents/:id/resolve` (does **not** resolve linked cases — context §5.4), `POST /api/staff/incidents/:id/notes` (one internal note broadcast to every linked case = "coordinated updates"); staff UI: incident panel in the case context (link/create, linked cases list, broadcast note), incident badge in the queue; customer surfaces unchanged. Then phase closure: smoke on the phase candidate, feature contexts refreshed, the PH-3 phase-approval evidence record (pending), PH-3 `APPROVED`, ledger 3/3 — and immediately open the Cycle Audit record in the audits directory (to be created; independent subagent reviewers, §8).
Why now: the last item of PH-3's scope; the audit obligation follows automatically.
Preconditions: `npm run verify` passes on HEAD; tree clean or attributable; CI green on HEAD or its failure diagnosed first; ledger 2/3.
Evidence/read first: `PROJECT_CONTEXT.md` §5.4 (shared incidents); `docs/features/FEAT-CASE/CONTEXT.md`; `GOVERNANCE.md` §6.4, §8 (audit due at 3/3, audit method).
If preconditions fail: CI red → diagnose and fix first. Unknown local changes → attribute and preserve (§4.3).
