# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-6.md`; base checkpoint: the PH-6.1 commit on `main` (child of `4b868e7`)

| Field | Value |
|---|---|
| Active objective / feature | PH-6 notifications and availability (OBJ-SUP-04): in-product notifications (done), e-mail through a boundary port with a labeled simulated outbox, outside-hours notice and reminders. Its approval makes the ledger 3/3 and opens Cycle Audit 2. |
| Active phase / subphase | PH-6 `ACTIVE` (`docs/phases/PH-6.md`). PH-6.1 `APPROVED` 2026-09-14 (`docs/phases/PH-6.1.md`); PH-6.2 `PLANNED` (e-mail port and outbox), PH-6.3 `PLANNED` (outside hours, reminders, closure). PH-1..PH-5 `APPROVED`. |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 2/3 (PH-4, PH-5), open cycle — **PH-6's approval will make it 3/3 and open Cycle Audit 2 (§6.4)**. |
| Blocking decisions / dependencies | None. PH-4 depends on ADR-0002 (boundary) and BL-001 (resolved: everything simulated, DEC-0003). |
| Integration / CI / release | Candidate: the PH-6.1 commit on `main`. Local: `npm run verify` exit 0, `npm run build` exit 0, browser smoke 47/47 — `docs/evidence/PH-6.1-verification.md` (CI verdict recorded there when known). `4b868e7` (PH-5) CI run 34816489000 success. Release: none, not authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0; earlier sessions ran on WSL2. The repo-local git author (DEC-0002) must be re-set on every fresh clone — see `docs/runbooks/VERIFICATION.md` "Setup". |
| Context route | `CONTEXT_INDEX.md` → four live feature contexts (all re-verified against the remediation commit); audit record `docs/audits/CYCLE-1.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Plan and run PH-6.2 (`docs/phases/PH-6.2.md`, to be created): an `EmailNotifierPort` in the boundary with a simulated adapter that writes a labeled `email_outbox` (to: masked address for display, subject, body with reference + link `/?case=<id>`, no message content); a `NotificationJob` that e-mails unread notifications older than the configured delay (settings `emailDelayMinutes`, default 15) once each; a per-customer preference (`customer_preferences.email_notifications`, default on) editable from the customer home; the raw address comes from `OrbitRecordsPort.contactEmail(userId)` and never crosses to the UI; `GET /api/support/emails` lists the customer's own simulated outbox (labeled Simulação) for evidence; e2e negatives on content and isolation; smoke: shorten the delay, wait, see the outbox entry.
Why now: PH-6.1 delivered the notifications the e-mail delay job consumes.
Preconditions: CI green on the PH-6.1 commit (`gh run list --limit 3`, record it in `docs/evidence/PH-6.1-verification.md`); tree clean; `npm run verify` passes. Process rule (FND-0028, BL-020): commits only through the gate-then-commit script; no unfinished files of a later block in the tree at commit time.
Evidence/read first: `docs/phases/PH-6.md` (scenario b); `docs/features/FEAT-NOTIFY/CONTEXT.md`; `PROJECT_CONTEXT.md` §4.4 (e-mail role: notification only, no private financial detail), §10.2 (masking), §13.2 (no infrastructure chosen); `apps/api/src/identity/simulated-orbit-records.ts` (raw contacts stay inside the adapter).
If preconditions fail: CI red → diagnose before any PH-4 work (§9.2). Unknown local changes → attribute and preserve (§4.3).
