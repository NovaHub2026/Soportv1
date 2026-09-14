# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/audits/CYCLE-3.md`, `docs/evidence/CYCLE-3-closure-verification.md`; base checkpoint: the Cycle Audit 3 closing commit (after `8c175fa`)

| Field | Value |
|---|---|
| Active objective / feature | PH-10 — the operating policies of DEC-0039 in the product. PH-11 (AI assistant first line) is planned. Internal loopback demo `v0.1.1-demo` unchanged. |
| Active phase / subphase | PH-10 `ACTIVE`; PH-10.1 `APPROVED` (schedule and time zone), PH-10.2 `APPROVED` (formal complaints); next PH-10.3 (exports on request, recovery to Verification, phase closure) `PLANNED`. PH-11 `PLANNED`. |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 3/3 — CLOSED. Cycle 3: 3/3 (PH-7, PH-8, PH-9) — CLOSED 2026-09-14 (`docs/audits/CYCLE-3.md`, FND-0082..FND-0100, all MINOR). Cycle 4: 0/3 (PH-10 counts at its approval). |
| Blocking decisions / dependencies | Owner: retention of closed cases (pending legal advice) and the e-mail provider — the rest of BL-002 was decided (DEC-0039); the AI provider account and its cost (PH-11). BL-001 (Orbit adapters) and the retention decision block any production release, which also needs the Owner's authorization (§1.1); hosting, TLS, secrets and a mail provider are Owner decisions — a deployment beyond loopback also sets `SUPPORT_TRUST_PROXY` with its TLS proxy (BL-026). |
| Integration / CI / release | Candidate: the PH-10.2 commit; CI pending at recording time (check `gh run list --limit 2`). `522edbf` (PH-10.1) CI run 34867235094 success (both jobs). Release: `v0.1.1-demo`, internal loopback demo; no production release authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0, Docker Engine 29.8.0 (test PostgreSQL on 127.0.0.1:55433). Fresh clone: set the git author (DEC-0002) and `git config core.hooksPath scripts/git-hooks`. |
| Context route | `CONTEXT_INDEX.md` → six live feature contexts; audit records `docs/audits/`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: plan and implement PH-10.3 — an admin-only export of one customer's support data on request (cases, public messages, attachment metadata, events; recorded with who asked and why — DEC-0039 h; the simulated directory needs an admin member), recovery requests forwarded to the Verification team by name (DEC-0039 i); then the PH-10 phase closure (gate + builds, `test:pg`, full smoke, phase approval — cycle 4 → 1/3).
Why now: PH-10.2 approved; PH-10.3 is the last planned block of the active phase.
Preconditions: the PH-10.2 commit green on both CI jobs.
Evidence/read first: `docs/phases/PH-10.md`, `docs/decisions/DECISION_LOG.md` DEC-0039, `docs/features/FEAT-ACCESS/CONTEXT.md`, `docs/features/FEAT-STAFF/CONTEXT.md`.
If preconditions fail: CI red → diagnose and fix through `scripts/gate-commit.sh` (§9.2).
