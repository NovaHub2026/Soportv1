# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-7.md`; base checkpoint: the Cycle Audit 2 closure / PH-7 start commit on `main` (child of `e3d843a`)

| Field | Value |
|---|---|
| Active objective / feature | PH-7 — access recovery and privacy hardening (FEAT-ACCESS new; FEAT-ORBIT, FEAT-CHAT, FEAT-STAFF, FEAT-CASE). Mode of work: ordinary development (Cycle Audit 2 CLOSED). |
| Active phase / subphase | PH-7 `ACTIVE` (`docs/phases/PH-7.md`); PH-7.1 `APPROVED` 2026-09-14; PH-7.2 `ACTIVE` (`docs/phases/PH-7.2.md` — roles and permissions). PH-1..PH-6 `APPROVED`. |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 3/3 — CLOSED 2026-09-14 (`docs/audits/CYCLE-2.md`). Cycle 3: 0/3 (PH-7's approval will count first). |
| Blocking decisions / dependencies | BL-016 (role model) is decided inside PH-7.2; the recovery route follows §4.5 (unverified contact, no account data) — Orbit's real verification process is BL-002 territory and stays simulated/labeled. |
| Integration / CI / release | Candidate: the PH-7.1 commit on `main` — `docs/evidence/PH-7.1-verification.md` (gate, build, smoke 51/51; CI verdict recorded there when known). `e3d843a` (Cycle Audit 2 remediation) CI run 34822158367 success; `9b4e193` (closure, docs) see `gh run list`. Release: none, not authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0. Fresh clone: set the git author (DEC-0002) and `git config core.hooksPath scripts/git-hooks` — `docs/runbooks/VERIFICATION.md` "Setup". |
| Context route | `CONTEXT_INDEX.md` → six live feature contexts (FEAT-ACCESS created with PH-7); audit records `docs/audits/CYCLE-1.md`, `CYCLE-2.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Execute PH-7.2 per `docs/phases/PH-7.2.md`: `staffMay(role, action, { owner })` in `packages/shared/src/identity.ts`; `CasesService` enforces it inside `mutate` for status, resolution, closure, consultations, attributes, transfer/release; the simulated identity refuses staff ids outside the directory and takes the role from the directory; the workspace disables refused actions with the reason; DEC-0029 records the role model (BL-016 closed); unit, e2e and web negatives; evidence `docs/evidence/PH-7.2-verification.md` (to be created); commit through `npm run gate`.
Why now: PH-7.1 approved; the role model is the second block of PH-7 and BL-016 has waited since Cycle Audit 1.
Preconditions: tree clean; CI green on the PH-7.1 commit (record it in `docs/evidence/PH-7.1-verification.md`). Commits only through `npm run gate <message-file>` (BL-020).
Evidence/read first: `docs/phases/PH-7.2.md`, `docs/BACKLOG.md` BL-016, `PROJECT_CONTEXT.md` §5.1, §10.2, RULE-SUP-02/-09, `docs/features/FEAT-ORBIT/CONTEXT.md` (roles in use, DEC-0012), `apps/api/src/cases/cases.service.ts` (`assertMayReassign`-style checks).
If preconditions fail: CI red → diagnose and fix through the gate before new work (§9.2). Unknown local changes → attribute and preserve (§4.3).
