# PH-10 — Phase approval
Type: PHASE APPROVAL EVIDENCE
Phase: PH-10 — Operating policies in the product (`../phases/PH-10.md`)
Recorded on: 2026-09-14
Candidate: the PH-10 approval commit on `main` (child of `c75526f`), which carries PH-10.3 and this record.
Decision: APPROVED by the Agent (evidence-based, §6.3; not a human review). First-time approval, counted in cycle 4: the ledger goes to 1/3.
Why the phase existed: the Owner decided the operating policies on 2026-09-14 (DEC-0039) and asked to continue; the product carried them as pending items until then.

## Outcome against the plan
| Block | Delivered | Evidence | Commit / CI |
|---|---|---|---|
| PH-10.1 schedule and time zone | 24/7 as the decided default, "24:00" closing, instants in availability and notices, the customer's own zone in the copy, "Dia inteiro" switch (DEC-0040) | `PH-10.1-verification.md` | `522edbf`, run 34867235094 success |
| PH-10.2 formal complaints | Customer topic, supervisor-only work, 5-business-day deadline, supervision list, reclassification (DEC-0041; migration `0021`) | `PH-10.2-verification.md` | `c75526f`, run 34868918054 success |
| PH-10.3 exports and recovery | Admin-only recorded export of a customer's data, recovery forwarded to the Verification team by name, an administrator in the simulated directory (DEC-0042; migration `0022`) | `PH-10.3-verification.md` | this commit; CI pending at recording |

## Acceptance scenarios (`PH-10.md`)
- RULE-SUP-08 — the availability copy states the decided service and, when narrowed, the window and next opening in the customer's zone: PH-10.1 claims 1, 5, 6.
- §10.1 — an outside-hours notice names the next opening in the customer's zone: PH-10.1 claim 5.
- §5.4 / RULE-SUP-02 — a complaint reaches a supervisor with its deadline; an agent cannot take it: PH-10.2 claims 4, 7, 9, 10.
- RULE-SUP-01 / RULE-SUP-09 — an export holds the customer's own data only, by an administrator only, recorded: PH-10.3 claims 2, 5, 7, 9.
- §4.5 — a recovery request names the team that takes it over: PH-10.3 claims 4, 5, 9.

## Integrated journey on the phase candidate
- Full browser smoke on the final code: exit 0, 59 observations, screenshots `screenshots/ph-10/` (34 files, 4.5 MB — the phase set, DEC-0034 c).
- api unit and e2e suites on PostgreSQL 16 with migrations `0021`–`0022`: 97/97 and 39/39.
- Unit and e2e on PGlite at the gate; production builds exit 0.

## Findings during the phase, fixed before approval
- PH-10.1: the first smoke run showed "Hoje: 00:00–00:00" for an all-day weekday in a narrowed week; worded "Hoje: atendimento 24 horas." with a test.
- PH-10.2: the unit tests hung — a settings query inside an open transaction deadlocks PGlite's single connection; the operation's zone is now read before any transaction opens.
- PH-10.2: the gate refused once on a timing flake of an untouched shell test under load; its first lookup now waits 5 s.
- PH-10.3: two test expectations were stale (a preference an earlier test had changed; the old recovery copy); corrected.

## What this approval does not claim
- Retention and deletion of closed cases (the Owner's, pending legal advice), the e-mail provider, and Orbit's real verification process or directory (BL-001) remain outside the product; the hand-off to Verification is a labeled simulation.
- Business days ignore public holidays; the complaint deadline is internal and notifies nobody.
- The customer's time zone is the browser's until Orbit's session carries one.
- No production release is implied (§1.1); the internal demo `v0.1.1-demo` predates PH-9 and PH-10.
