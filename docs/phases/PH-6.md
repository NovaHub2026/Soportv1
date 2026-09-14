# PH-6 — Notifications and availability
Type: PHASE CONTEXT
Status: PLANNED
Objective / Feature IDs: OBJ-SUP-04; FEAT-NOTIFY (new), FEAT-CHAT, FEAT-CASE
Cycle: 2 (see `ROADMAP.md`; PH-4 and PH-5 counted, 2/3 — this phase's approval triggers Cycle Audit 2)

## Outcome and why now
Customers learn that support replied even when the panel is closed: an in-product notification with a badge, and — when a reply stays unread — an e-mail that brings them back to the authenticated conversation without exposing private financial detail; outside the configured hours the conversation says so honestly and states the next attention period; reminders keep waiting-for-customer cases from dying silently, and none of these automated notices ever counts as a human response (`PROJECT_CONTEXT.md` §4.4, §7.4, §14 success signals, RULE-SUP-08). Why now: PH-5.4 delivered the configured schedule this phase consumes; PH-2's live streams carry the in-product signal; PH-6 is the next `PLANNED` phase and depends only on PH-2.

## Scope, non-goals and dependencies
In scope: customer notifications (staff reply, waiting-for-you, resolved, closed, follow-up reminder) with read state and a badge in the host, live over the customer-wide stream; e-mail notifications through a boundary port with a simulated adapter (no provider chosen — BL-002, §13.2) that records an inspectable, labeled outbox, links back to the conversation and carries no case content beyond the reference; per-customer e-mail preference; outside-hours system notice when a case is opened or a message arrives while support is closed; reminders for cases waiting for the customer after a configurable delay; metrics unaffected by automated notices.
Non-goals: e-mail as a two-way channel (§4.4 initial email role), push/SMS/WhatsApp, a real mail provider (PH-8 chooses one), staff notifications beyond the existing overview/badges, marketing content.
Dependencies: PH-2 (approved), PH-5.4 settings. Uses DEC-0015 (customer projection), DEC-0017 (lock rule), DEC-0023 (schedule).

## Product rules and acceptance scenarios
- RULE-SUP-01/-04: notifications and e-mails never include internal notes or record data; e-mails contain only the case reference, the kind of update and a link to the authenticated conversation.
- RULE-SUP-08: outside-hours notices come from the configured schedule; nothing promises a response time.
- §14: automated acknowledgements are system messages and are excluded from first-response metrics.
- RULE-SUP-03: a notification is created exactly once per event; reminders are sent once per waiting period.
Scenarios: (a) staff reply → badge "1" on the host's "Suporte" button and a notification "Nova resposta em SUP-000001"; opening the case marks it read; (b) reply unread for the configured delay → a simulated e-mail appears in the labeled outbox with subject, reference and a link, no message text; the customer can turn e-mails off; (c) a case opened at 22:30 gets the system notice "Fora do horário de atendimento…" with the next opening; it does not count as a human reply in metrics; (d) a case waiting for the customer for the configured delay gets a reminder notification (and e-mail if enabled), once; (e) a follow-up opened from a closed case does not generate a reminder for the closed parent.

## Important uncertainties and decision references
- No mail infrastructure exists (BL-002); the port and the simulated outbox are the honest stand-in (DEC-0003 discipline: labeled simulation).
- Delays (e-mail after 15 min unread, reminder after 48 h) are working defaults in settings.

## Planned subphases, adjusted as evidence arrives
| ID | Block | Status |
|---|---|---|
| PH-6.1 | In-product notifications: table, creation on customer-facing events, read state, endpoints, host badge and list, live refresh — `PH-6.1.md` | PLANNED |
| PH-6.2 | E-mail through a boundary port with a simulated labeled outbox, delay job, per-customer preference | PLANNED |
| PH-6.3 | Outside-hours notice from the schedule, waiting-for-customer reminders, metrics exclusion check; phase closure | PLANNED |

## Verification and operational readiness
Per subphase: service and e2e tests (creation exactly once, read state, customer isolation, e-mail content negatives, outside-hours notice, reminder idempotence, metrics exclusion), web tests (badge, list, preference), browser smoke extended with the badge and the outbox. `npm run verify` before each commit; `npm run verify:full` and the smoke on the phase candidate. Jobs run in the single API instance until PH-8.

## Completion evidence, findings and context updated
Pending — filled at phase approval.
