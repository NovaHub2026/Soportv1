# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-5.md`; base checkpoint: the PH-5.4 commit on `main` (child of `c3fc6a8`, PH-5 phase candidate)

| Field | Value |
|---|---|
| Active objective / feature | PH-5 delivered and approved (views, search, saved replies, schedule with honest availability copy, supervision, metrics). Next: PH-6 notifications and availability (in-product notifications, e-mail notifications linking back, outside-hours behavior — the schedule from PH-5.4 is its input). |
| Active phase / subphase | None active. PH-5 `APPROVED` 2026-09-14 (PH-5.1–5.4 approved). PH-1..PH-4 `APPROVED`. PH-6 `PLANNED` — next to start (`docs/phases/PH-6.md`, to be created). |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 2/3 (PH-4, PH-5), open cycle — **PH-6's approval will make it 3/3 and open Cycle Audit 2 (§6.4)**. |
| Blocking decisions / dependencies | None. PH-4 depends on ADR-0002 (boundary) and BL-001 (resolved: everything simulated, DEC-0003). |
| Integration / CI / release | Candidate: the PH-5.4 commit on `main` (PH-5 phase candidate). Local: `npm run verify:full` exit 0, browser smoke 46/46 — `docs/evidence/PH-5.4-verification.md`, `docs/evidence/PH-5-phase-approval.md` (CI verdict recorded in the PH-5.4 record when known). Earlier in PH-5: `3217c53` and `6d11ee8` CI red (FND-0028), `c3fc6a8` corrective. Release: none, not authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0; earlier sessions ran on WSL2. The repo-local git author (DEC-0002) must be re-set on every fresh clone — see `docs/runbooks/VERIFICATION.md` "Setup". |
| Context route | `CONTEXT_INDEX.md` → four live feature contexts (all re-verified against the remediation commit); audit record `docs/audits/CYCLE-1.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Plan PH-6 (`docs/phases/PH-6.md`, to be created; ROADMAP: notifications and availability) into subphases: (1) in-product notifications — a per-customer notification feed/badge for replies and status changes fed by `case_events`, marked read, live over the existing customer-wide stream; (2) e-mail notifications through a boundary port (`NotificationPort`) with a simulated/logging adapter since no mail provider is chosen (BL-002, §13.2), linking back to the authenticated conversation and never carrying private financial detail (§4.4); (3) outside-hours behavior — an automatic system notice in the conversation when a case is opened or a message arrives outside the configured schedule ("registramos sua mensagem; próximo atendimento …"), never counted as a human response in metrics (§14 success signals); reminders for waiting-for-customer cases and staff nudges for overdue follow-up (§7.4) as the last block; then phase approval. PH-6's approval makes the ledger 3/3 → open Cycle Audit 2 before PH-7.
Why now: PH-5 is approved; PH-6 depends on PH-2 (approved) and consumes PH-5.4's schedule.
Preconditions: CI green on the PH-5.4 commit (`gh run list --limit 3`, record it in `docs/evidence/PH-5.4-verification.md`); tree clean; `npm run verify` passes. Process rule (FND-0028, BL-020): commits only through the gate-then-commit script; no unfinished files of a later block in the tree at commit time.
Evidence/read first: `PROJECT_CONTEXT.md` §4.4 (notifications, outside hours), §7.4 (reminders), §13.2 (notification infrastructure unknown), §14 (automated acknowledgements must not inflate the human-response metric); `docs/features/FEAT-CHAT/CONTEXT.md`; `packages/shared/src/settings.ts` (schedule); `apps/api/src/cases/supervision.service.ts` (first-response metric counts public staff messages only).
If preconditions fail: CI red → diagnose before any PH-4 work (§9.2). Unknown local changes → attribute and preserve (§4.3).
