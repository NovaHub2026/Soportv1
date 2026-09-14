# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-6.md`; base checkpoint: the PH-6.2 commit on `main` (child of `4136176`)

| Field | Value |
|---|---|
| Active objective / feature | PH-6 notifications and availability (OBJ-SUP-04): in-product notifications (done), e-mail through a boundary port with a labeled simulated outbox, outside-hours notice and reminders. Its approval makes the ledger 3/3 and opens Cycle Audit 2. |
| Active phase / subphase | PH-6 `ACTIVE` (`docs/phases/PH-6.md`). PH-6.1, PH-6.2 `APPROVED` 2026-09-14; PH-6.3 `PLANNED` (outside-hours notice, reminders, closure). PH-1..PH-5 `APPROVED`. |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 2/3 (PH-4, PH-5), open cycle — **PH-6's approval will make it 3/3 and open Cycle Audit 2 (§6.4)**. |
| Blocking decisions / dependencies | None. PH-4 depends on ADR-0002 (boundary) and BL-001 (resolved: everything simulated, DEC-0003). |
| Integration / CI / release | Candidate: the PH-6.2 commit on `main`. Local: `npm run verify` exit 0, `npm run build` exit 0, browser smoke 48/48 — `docs/evidence/PH-6.2-verification.md` (CI verdict recorded there when known). `4136176` (PH-6.1) CI run 34817018198 success. Release: none, not authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0; earlier sessions ran on WSL2. The repo-local git author (DEC-0002) must be re-set on every fresh clone — see `docs/runbooks/VERIFICATION.md` "Setup". |
| Context route | `CONTEXT_INDEX.md` → four live feature contexts (all re-verified against the remediation commit); audit record `docs/audits/CYCLE-1.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Plan and run PH-6.3 (`docs/phases/PH-6.3.md`, to be created): (1) outside-hours notice — when a case is created or a customer message arrives while `computeAvailability` says closed, a system message "Fora do horário de atendimento. Registramos sua mensagem; próximo atendimento: <dia> às <hora>." is posted once per closed period per case (no duplicate for consecutive messages), author `system`, never counted as a human reply (metrics count public staff messages only — add a test), plus an `outside_hours` notification; (2) reminders — `ReminderJob` (settings `reminderAfterHours`, default 48) posts a `reminder` notification (and e-mail through the existing job) once per waiting-for-customer period for cases in `waiting_customer` with no customer message since the staff request; never for closed parents of follow-ups; `reminder_sent` event; (3) smoke: outage of hours via a saved schedule that is closed today, then reopen; then the PH-6 phase approval record (scenarios a–e), ledger 3/3 → open Cycle Audit 2 (`docs/audits/CYCLE-2.md`) before PH-7.
Why now: PH-6.1 and PH-6.2 are approved; PH-6.3 closes the active phase.
Preconditions: CI green on the PH-6.2 commit (`gh run list --limit 3`, record it in `docs/evidence/PH-6.2-verification.md`); tree clean; `npm run verify` passes. Process rule (FND-0028, BL-020): commits only through the gate-then-commit script; no unfinished files of a later block in the tree at commit time.
Evidence/read first: `docs/phases/PH-6.md` (scenarios c–e); `PROJECT_CONTEXT.md` §4.4 (outside hours), §7.4 (reminders, inactivity ≠ solution), §14 (automated acknowledgements must not inflate the human-response metric); `packages/shared/src/settings.ts` (`computeAvailability`); `apps/api/src/cases/notification.job.ts` (reuse for reminder e-mails).
If preconditions fail: CI red → diagnose before any PH-4 work (§9.2). Unknown local changes → attribute and preserve (§4.3).
