# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-7.md`; base checkpoint: the Cycle Audit 2 closure / PH-7 start commit on `main` (child of `e3d843a`)

| Field | Value |
|---|---|
| Active objective / feature | PH-7 — access recovery and privacy hardening (FEAT-ACCESS new; FEAT-ORBIT, FEAT-CHAT, FEAT-STAFF, FEAT-CASE). Mode of work: ordinary development (Cycle Audit 2 CLOSED). |
| Active phase / subphase | PH-7 `ACTIVE` (`docs/phases/PH-7.md`); PH-7.1 and PH-7.2 `APPROVED` 2026-09-14; PH-7.3 `ACTIVE` (`docs/phases/PH-7.3.md` — shared-device sign-out, idle sign-out, privacy re-check, phase closure). PH-1..PH-6 `APPROVED`. |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 3/3 — CLOSED 2026-09-14 (`docs/audits/CYCLE-2.md`). Cycle 3: 0/3 (PH-7's approval will count first). |
| Blocking decisions / dependencies | None. BL-016 decided (DEC-0029). Orbit's real verification process and sessions stay simulated/labeled (BL-001/BL-002). |
| Integration / CI / release | Candidate: the PH-7.2 commit on `main` — `docs/evidence/PH-7.2-verification.md` (gate, build, smoke 52/52; CI verdict recorded there when known). `968ae88` (PH-7.1) CI run 34823601278 success; `9b4e193` run 34822550972 failure (FND-0057, guard fixed in the PH-7.2 commit). Release: none, not authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0. Fresh clone: set the git author (DEC-0002) and `git config core.hooksPath scripts/git-hooks` — `docs/runbooks/VERIFICATION.md` "Setup". |
| Context route | `CONTEXT_INDEX.md` → six live feature contexts (FEAT-ACCESS created with PH-7); audit records `docs/audits/CYCLE-1.md`, `CYCLE-2.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Execute PH-7.3 per `docs/phases/PH-7.3.md`: `signOut()` in `apps/web/src/lib/simulated-session.ts` (clears selection, session buffers, in-memory state), "Sair" in the host shell and the staff workspace with a neutral labeled picker when signed out, idle sign-out on the host (30 min working default), e2e privacy negatives for incident notes / consultations / internal notes across customer surfaces after the role model; web tests; smoke observations (sign-out, picker); evidence `docs/evidence/PH-7.3-verification.md` (to be created) and the phase approval `docs/evidence/PH-7-phase-approval.md` (to be created); ledger cycle 3 → 1/3; commit through `npm run gate`.
Why now: PH-7.1 and PH-7.2 approved; sign-out is the last block of PH-7 and its phase closure.
Preconditions: tree clean; CI green on the PH-7.2 commit (record it in `docs/evidence/PH-7.2-verification.md`). Commits only through `npm run gate <message-file>` (BL-020).
Evidence/read first: `docs/phases/PH-7.3.md`, `docs/phases/PH-7.md` (scenarios d and e), `PROJECT_CONTEXT.md` §10.2, RULE-SUP-01/-04; `apps/web/src/lib/simulated-session.ts`, `apps/web/src/features/shell/OrbitShell.tsx`, `apps/web/src/features/staff/StaffWorkspace.tsx`.
If preconditions fail: CI red → diagnose and fix through the gate before new work (§9.2). Unknown local changes → attribute and preserve (§4.3).
