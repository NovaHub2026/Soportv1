# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-7.md`; base checkpoint: the Cycle Audit 2 closure / PH-7 start commit on `main` (child of `e3d843a`)

| Field | Value |
|---|---|
| Active objective / feature | PH-7 — access recovery and privacy hardening (FEAT-ACCESS new; FEAT-ORBIT, FEAT-CHAT, FEAT-STAFF, FEAT-CASE). Mode of work: ordinary development (Cycle Audit 2 CLOSED). |
| Active phase / subphase | PH-7 `ACTIVE` (`docs/phases/PH-7.md`); PH-7.1 `ACTIVE` (`docs/phases/PH-7.1.md` — "Não consigo acessar minha conta" route). PH-1..PH-6 `APPROVED`. |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 3/3 — CLOSED 2026-09-14 (`docs/audits/CYCLE-2.md`). Cycle 3: 0/3 (PH-7's approval will count first). |
| Blocking decisions / dependencies | BL-016 (role model) is decided inside PH-7.2; the recovery route follows §4.5 (unverified contact, no account data) — Orbit's real verification process is BL-002 territory and stays simulated/labeled. |
| Integration / CI / release | Candidate: the PH-7 start commit on `main` (docs only after `e3d843a`). `e3d843a` (Cycle Audit 2 remediation) CI run 34822158367 success. Release: none, not authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0. Fresh clone: set the git author (DEC-0002) and `git config core.hooksPath scripts/git-hooks` — `docs/runbooks/VERIFICATION.md` "Setup". |
| Context route | `CONTEXT_INDEX.md` → six live feature contexts (FEAT-ACCESS created with PH-7); audit records `docs/audits/CYCLE-1.md`, `CYCLE-2.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Execute PH-7.1 per `docs/phases/PH-7.1.md`: shared contracts (`packages/shared/src/access.ts`, to be created), table `access_recovery_requests` (migration `0016`), public endpoint `POST /api/public/access-recovery` (no identity, light abuse limit), staff endpoints under `/api/staff/access-recovery`, host link "Não consigo acessar minha conta" with the form and its reference, staff "Recuperação de acesso" page; unit, e2e and web tests; smoke observation; evidence `docs/evidence/PH-7.1-verification.md`; commit through `npm run gate`.
Why now: Cycle Audit 2 closed; PH-7 is the next `PLANNED` phase and its dependencies (PH-3, PH-4) are approved; §4.5 and §14 item 8 are the last customer-facing situations without an implementation.
Preconditions: tree clean; CI green on HEAD. Commits only through `npm run gate <message-file>` (BL-020).
Evidence/read first: `docs/phases/PH-7.md`, `docs/phases/PH-7.1.md`, `docs/features/FEAT-ACCESS/CONTEXT.md`, `PROJECT_CONTEXT.md` §4.5, §10.2, §14 item 8, RULE-SUP-01/-04; `docs/features/FEAT-ORBIT/CONTEXT.md` (identity boundary).
If preconditions fail: CI red → diagnose and fix through the gate before new work (§9.2). Unknown local changes → attribute and preserve (§4.3).
