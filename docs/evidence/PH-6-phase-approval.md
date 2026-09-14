# PH-6 — Phase approval evidence
Type: VERIFICATION EVIDENCE
Work item: PH-6 — Notifications and availability (phase-level acceptance, `GOVERNANCE.md` §6.3)
Recorded on: 2026-09-14
Revision: the PH-6.2 commit plus the PH-6.3 working tree (the PH-6.3 commit on `main` is the phase candidate).
Environment: as in `PH-4.1-verification.md`.

## Phase scenarios (from `docs/phases/PH-6.md`) and evidence
| # | Scenario | Evidence | Category |
|---|---|---|---|
| a | Staff reply → badge and "Nova resposta em SUP-000001"; opening the case marks it read | Service + e2e + web tests; smoke `notification` (PH-6.1) and `email-simulated` (badge on Bruno's host, PH-6.2) | EXECUTED + OBSERVED |
| b | Reply unread for the delay → simulated e-mail with reference and link, no message text; the customer can opt out | Service test (once, unread only, opt-out, no address), e2e (preference, outbox labeled, no raw address), web test; smoke `email-simulated` (PH-6.2) | EXECUTED + OBSERVED |
| c | A case opened outside hours gets the system notice with the next opening; it does not count as a human reply | Service test (one notice per 12 h, `firstResponse.count === 0`), e2e; smoke `outside-hours` (PH-6.3) | EXECUTED + OBSERVED |
| d | A case waiting for the customer gets one reminder after the delay | Service test (`remindDue` with an injected clock: not before, once, again after a new period) (PH-6.3) | EXECUTED |
| e | A closed case never gets a reminder | Service test (closed case: 0 reminders, no `reminder_sent` event) (PH-6.3) | EXECUTED |

## Rules
RULE-SUP-01/-04: notifications and e-mails carry the kind and reference only (e2e negatives on content; outbox never stores the raw address). RULE-SUP-03: one notification per event (retry test), one e-mail per notification, one reminder per waiting period. RULE-SUP-08: the outside-hours notice and the home's availability line come from the configured schedule; no response time is promised anywhere. §14: automated notices are `system` messages excluded from the first-response metric (test). §7.4: reminders never resolve or close a case.

## Delivery states (§6.3)
Implemented and locally verified: yes. Integrated: `main` (PH-6.3 commit). CI verified: recorded in `PH-6.3-verification.md`. Released: no.

## Uses simulation
Simulated identity, records and staff roles (DEC-0003) and a simulated e-mail adapter (DEC-0025): no real e-mail is sent; the outbox is the labeled evidence surface. Nothing here demonstrates a connected mail provider or Orbit capability (context §11).

## Findings during the phase
None open. Harness: the smoke's reference numbering assumed no extra cases before the contextual-entry block; the notification blocks were moved after it. Backlog unchanged (BL-013, BL-014, BL-016..BL-020 open).

## Approval
PH-6 `APPROVED` on 2026-09-14 by the Agent (evidence-based, not a human review). Ledger: cycle 2, **3/3 — Cycle Audit 2 is due now** (`docs/audits/CYCLE-2.md`, opened with this approval; ordinary feature development pauses until it closes — §6.4).
