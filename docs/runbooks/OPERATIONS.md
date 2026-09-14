# Operations runbook
Type: RUNBOOK
Scope: how the support operation is configured and watched, and which operating decisions are still the Owner's/Operations' (`PROJECT_CONTEXT.md` §13.2, BL-002); PH-8.3
Verified on: 2026-09-14

## Operating policies (Owner, 2026-09-14 — DEC-0039)
Decided by the Owner question by question. "In the product" says whether the software already follows the decision (PH-10 brought the decided ones in). Two items stay open: retention (legal advice) and the e-mail provider.
| Policy | Decided | In the product today | Where it lives |
|---|---|---|---|
| Service hours and time zone | Human team 24/7; internal times America/Sao_Paulo, shown to each customer in their own time zone | **Done in PH-10.1**: 24/7 is the default configuration, availability and notices carry instants shown in the customer's zone | Supervision → settings ("Dia inteiro" per day); customer availability copy |
| First line | An AI assistant (future phase; the Owner named ChatGPT); a customer who asks for a person is transferred; disputes and security always go to a person (RULE-SUP-10) | Not built — PH-11, the Owner's build directly with GPT from `../phases/PH-11.md` | — |
| Staffing and coverage | 24/7 coverage; the people come from Orbit's staff directory | Four simulated members (two agents, a supervisor, an administrator since PH-10.3) | Orbit's directory (BL-001) |
| Response and follow-up targets | None yet | Metrics without targets (`targets: null`) | — |
| Attention threshold (overdue) | 4 h without a human reply / waiting for a team | Same | Supervision → settings |
| Follow-up window before closure | 7 days | Same | Supervision → settings (`followUpWindowDays`) |
| E-mail delay and reminder delay | 15 min unread → e-mail; 48 h waiting → one reminder | Same | Supervision → settings |
| Consultation teams | Finance, operations, security, verification, product | Same | `packages/shared` |
| Roles | agent / supervisor / admin (DEC-0029) | Same | Orbit's directory (BL-001) |
| Formal complaints | A topic the customer can choose ("Reclamação formal"), routed to a supervisor, internal deadline 5 business days, recorded; staff may reclassify | **Done in PH-10.2**: category, deadline on the case (business days of the operation's zone, no holiday calendar), agents locked out, supervision section | Customer topic chips; supervision → "Reclamações formais"; category in the case context |
| Exports of a customer's data | An admin only, on the customer's request, recorded | **Done in PH-10.3**: supervision → "Exportar dados de um cliente" (administrators), the JSON goes to the administrator's browser, every export is recorded with the reason | Supervision (admin); `GET /api/staff/data-exports` |
| Account recovery procedure | Forwarded to the Verification team, which uses Orbit's KYC process | **Done in PH-10.3** (naming): receipts and the staff page name the Verification team; the hand-off is a labeled simulation until Orbit's process exists (BL-001) | Staff recovery page |
| Retention of closed cases | **Pending legal advice** — nothing deleted meanwhile | Nothing deleted except uploads never linked (24 h) | Policy first, then a job |
| E-mail provider | **Decided later** (paid service) | Simulated outbox | `EmailNotifierPort` adapter |

## Daily operation
- Queue oversight: the supervision page shows unassigned cases, cases awaiting a human reply, cases waiting for a team, load per agent and the overdue list; reassign from there (DEC-0012, DEC-0029).
- Availability copy: customers see the configured schedule in their own time zone (24/7 says so and announces nothing else); keep the schedule true (RULE-SUP-08).
- Access recovery: the "Recuperação de acesso" page lists unverified contacts; reach the person and record the outcome (never ask for a password or code — §4.5).
- Health: `GET /api/health` (driver, identity label); the API log shows job activity and refused actions. Backups: `DEPLOYMENT.md`.
- E-mail dead letters (DEC-0043 b): a send that failed `SUPPORT_EMAIL_MAX_ATTEMPTS` times is logged as "parked as a dead letter" with the notification id and is never retried; the in-product notification stays. To re-queue one after the provider recovers, clear `email_failed_at` (and `email_attempts`) on that `case_notifications` row; raising the limit alone resurrects nothing.

## What staff must never do
- Ask a customer for a password, 2FA code or recovery secret (§4.5).
- Paste internal notes or consultation text into a customer reply (RULE-SUP-04 — the workspace keeps them apart).
- Change money, trades or permissions from a case (RULE-SUP-05 — the product has no such action).
