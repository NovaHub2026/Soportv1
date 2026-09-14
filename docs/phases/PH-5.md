# PH-5 — Staff workspace completeness and supervision
Type: PHASE CONTEXT
Status: ACTIVE
Objective / Feature IDs: OBJ-SUP-03; FEAT-STAFF, FEAT-CASE, FEAT-CHAT
Cycle: 2 (see `ROADMAP.md`; PH-4 counted, 1/3)

## Outcome and why now
Staff can see and work every case that needs attention — not only the open ones: waiting for the customer, waiting for an internal team, resolved and closed history — find a case by reference, customer, subject or record, answer faster with saved replies, and supervisors can review outstanding demand, redistribute work, examine overdue follow-up, configure the operating schedule and read honest service outcomes (`PROJECT_CONTEXT.md` §5.2, §5.4, §14 item 9). Why now: Cycle Audit 1 recorded that §14.9 was only partly demonstrated (FND-0023, BL-011: a resolved case is reachable in no queue) and PH-4 is approved; PH-5 depends only on PH-3.

## Scope, non-goals and dependencies
In scope: queue views for every lifecycle state plus "needs attention" signals (unanswered customer messages and their age, overdue follow-up), pagination; filters and search (reference, user id, subject, record reference, category, priority, agent); saved replies (create, edit, use in the composer); service schedule/configuration with honest customer-facing availability copy (RULE-SUP-08); supervision overview (demand by status and agent, overdue lists, reassignment from the overview); service metrics computed from the attributable history (time to first human response, age of unanswered cases, time to resolution, reopen rate) without invented targets (§13.2, BL-002).
Non-goals: notifications and reminders (PH-6); role model beyond the existing agent/supervisor/admin labels (PH-7 — supervision surfaces are gated by the simulated role and say so); export/reporting beyond the on-screen metrics; a workforce-forecasting tool (context §9 non-goals).
Dependencies: PH-3 (approved). Uses DEC-0015 (customer projection), DEC-0017 (lock rule for any new case write).

## Product rules and acceptance scenarios
- RULE-SUP-02: every case remains findable in a view and with a responsible person; reassignment from the overview keeps history.
- RULE-SUP-08: availability copy shown to customers comes from the configured schedule and never promises what is not configured; metrics show what happened, not targets.
- RULE-SUP-09: saved replies and settings changes are attributable (author, updated by).
- §5.4: priority reflects impact; the overview lets supervisors act on the oldest unanswered and the overdue.
Scenarios (§14 item 9): (a) an agent switches to "Aguardando cliente" and "Aguardando equipe" and sees since when each case waits; (b) a resolved case is found under "Resolvidos" and a closed one under "Encerrados"; (c) a supervisor sees how many cases wait unassigned and the oldest unanswered customer message, and reassigns a case from the overview; (d) a search by `SUP-000003`, by `cust-alice` or by `WD-48213` finds the case; (e) an agent inserts a saved reply, edits it and sends; (f) a supervisor sets the schedule and the customer panel shows the configured hours honestly; (g) metrics show time to first response and resolution for the period, labeled as computed from history with no targets.

## Important uncertainties and decision references
- Real operating hours, targets and roles are unknown (BL-002); defaults are labeled configurable and the UI says so.
- Search is SQL `ILIKE`/equality over the case table; full-text search is deferred (ADR-0003 revisit if needed).
- Supervision gating by the simulated role is provisional until PH-7.

## Planned subphases, adjusted as evidence arrives
| ID | Block | Status |
|---|---|---|
| PH-5.1 | Views for every state, attention signals (unanswered since), pagination, history indexes — `PH-5.1.md`, approved 2026-09-14 | APPROVED |
| PH-5.2 | Filters and search (reference, user id, subject, record reference, category, priority, agent) | PLANNED |
| PH-5.3 | Saved replies: table, endpoints, composer picker, attributable edits | PLANNED |
| PH-5.4 | Schedule/configuration with customer availability copy, supervision overview with reassignment, service metrics; phase closure | PLANNED |

## Verification and operational readiness
Per subphase: service and e2e tests (views, search, saved replies, settings, overview, metrics — negatives for role gating and customer access), web tests, browser smoke extended with the new views, search, saved reply, schedule copy and overview. `npm run verify` before each commit; `npm run verify:full` and the smoke on the phase candidate.

## Completion evidence, findings and context updated
Pending — filled at phase approval.
