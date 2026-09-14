# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-9.md`, `docs/evidence/PH-9.1-verification.md`; base checkpoint: the PH-9.1 commit (after `c73b1b6`)

| Field | Value |
|---|---|
| Active objective / feature | PH-9 — Release-candidate debt: the Agent-owned backlog the audits carried past PH-8 (Owner: «continua con las siguientes fases pendientes»). Internal loopback demo `v0.1.1-demo` unchanged. |
| Active phase / subphase | PH-9 `ACTIVE`; PH-9.1 `APPROVED` (case-domain debt: BL-022, BL-029, BL-013 API, BL-018); next PH-9.2 (staff workspace) `PLANNED`, then PH-9.3 (customer panel) and PH-9.4 (operations, process, phase closure). |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 3/3 — CLOSED. Cycle 3: 2/3 (PH-7, PH-8) — out-of-band audit `docs/audits/CYCLE-3-OOB.md` CLOSED; PH-9's approval makes it 3/3 and the Cycle Audit due (§6.4). |
| Blocking decisions / dependencies | None for PH-9. Owner: confirm or withdraw the demo's gate #5 reading (`docs/evidence/RELEASE-2026-09-14b.md`); BL-001 (Orbit adapters) and BL-002 (operating policies) block any production release, which also needs the Owner's authorization (§1.1); hosting, TLS, secrets and a mail provider are Owner decisions. |
| Integration / CI / release | Candidate: the PH-9.1 commit; CI pending at recording time (check `gh run list --limit 2`). `c73b1b6` CI success (both jobs). Release: `v0.1.1-demo`, internal loopback demo; no production release authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0, Docker Engine 29.8.0. Fresh clone: set the git author (DEC-0002) and `git config core.hooksPath scripts/git-hooks`. |
| Context route | `CONTEXT_INDEX.md` → six live feature contexts; phase `docs/phases/PH-9.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: plan and implement PH-9.2 — staff workspace: BL-014 (one action helper, `StaffCaseView.tsx` split), BL-013 web part (note retry key, composer chips kept until success, attachments on pending/failed rows), BL-024 carried items (queue tab semantics, raw number fields in the settings form, system-message copy through the dictionary).
Why now: PH-9.1 approved; PH-9.2 is the next planned block of the active phase.
Preconditions: the PH-9.1 commit green on both CI jobs.
Evidence/read first: `docs/phases/PH-9.md`, `docs/features/FEAT-STAFF/CONTEXT.md`, `docs/BACKLOG.md` rows BL-013, BL-014, BL-024.
If preconditions fail: CI red → diagnose and fix through `scripts/gate-commit.sh` (§9.2).
