# Operations runbook
Type: RUNBOOK
Scope: how the support operation is configured and watched, and which operating decisions are still the Owner's/Operations' (`PROJECT_CONTEXT.md` §13.2, BL-002); PH-8.3
Verified on: 2026-09-14

## Decisions this product needs from the Owner / Operations (pending)
Nothing below is invented by the product: each item is a working default the software carries until Operations decides (RULE-SUP-08). Record each decision in `../decisions/DECISION_LOG.md` and configure it where indicated.
| Decision | Owner | Working default today | Where it is configured |
|---|---|---|---|
| Service hours and time zone | Operations | weekdays 09:00–18:00 America/Sao_Paulo, labeled "working default" to customers | Supervision → settings (schedule, time zone) |
| Staffing and coverage | Operations | three simulated agents (directory in `packages/shared`) | replaced by Orbit's staff directory (BL-001) |
| Response and follow-up targets | Operations | none — metrics show medians/p90 without targets (`targets: null`) | a future settings field once targets exist |
| Attention threshold (overdue) | Operations | 4 h without a human reply / waiting for a team | Supervision → settings |
| Follow-up window before closure | Operations | 7 days | Supervision → settings (`followUpWindowDays`) |
| E-mail delay and reminder delay | Operations | 15 min unread → e-mail; 48 h waiting → one reminder | Supervision → settings |
| Roles and specialist contacts | Operations + security owners | agent / supervisor / admin (DEC-0029); consultation teams: finance, security, product | directory (BL-001); teams in `packages/shared` |
| Account recovery procedure | Orbit's security process | recovery requests recorded and "forwarded" as a labeled simulation (DEC-0028) | replaced by the real hand-off (BL-001/BL-002) |
| Retention, exports, formal complaints | Operations + legal/privacy | nothing deleted or exported automatically; no complaint workflow | policy first, then a job (BL-009 for orphan uploads) |
| Notification channel and provider | Owner (paid service) | simulated outbox only (DEC-0025) | `EmailNotifierPort` adapter |

## Daily operation
- Queue oversight: the supervision page shows unassigned cases, cases awaiting a human reply, cases waiting for a team, load per agent and the overdue list; reassign from there (DEC-0012, DEC-0029).
- Availability copy: customers see the configured schedule and whether it is still a working default; keep it true (RULE-SUP-08).
- Access recovery: the "Recuperação de acesso" page lists unverified contacts; reach the person and record the outcome (never ask for a password or code — §4.5).
- Health: `GET /api/health` (driver, identity label); the API log shows job activity and refused actions. Backups: `DEPLOYMENT.md`.

## What staff must never do
- Ask a customer for a password, 2FA code or recovery secret (§4.5).
- Paste internal notes or consultation text into a customer reply (RULE-SUP-04 — the workspace keeps them apart).
- Change money, trades or permissions from a case (RULE-SUP-05 — the product has no such action).
