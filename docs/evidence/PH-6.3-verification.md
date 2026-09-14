# PH-6.3 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-6.3 — Outside-hours notice, reminders, phase closure
Recorded on: 2026-09-14
Revision: base: the PH-6.2 commit plus the PH-6.3 working tree, committed as the next commit on `main` (this record travels with it — §3.4; it is also the PH-6 phase candidate).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | With every day closed, a case creation plus a second message produce exactly one system notice and one `outside_hours` notification; the notice does not count as a human first response; with hours open no notice is posted. A `waiting_customer` case is reminded once after the delay (event `reminder_sent`, notification `reminder`), not before, again after a new waiting period, and never when closed | EXECUTED (incl. negatives) | `npm test -w api` (2 new tests) | see "Final gate run" |
| 2 | HTTP: `reminderAfterHours: 0` → 400; with the schedule closed a new case carries the system notice and the `outside_hours` notification; migration `0014` (columns, enum value) applied on fresh databases | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (1 new test) | see "Final gate run" |
| 3 | Web: the settings form exposes the reminder delay; the history label for `reminder_sent` exists | EXECUTED | `npm test -w web` (fixture updated), typecheck | see "Final gate run" |
| 4 | Integrated behavior in Chromium: with the schedule closed, Carla's new case shows "Fora do horário de atendimento. Registramos sua mensagem…" as an "Aviso" and her home says "Atendimento fechado agora."; the schedule is restored afterwards | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-6` | see "Smoke" |
| 5 | Full gate and production builds on the phase candidate | EXECUTED | `npm run verify` (gate-then-commit) + `npm run build` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: reminders in a browser (hours cannot elapse in the smoke; unit-tested with an injected clock).

## Smoke
49 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-6/01`–`25` (the PH-6 phase-candidate run). New observation `outside-hours`: with every day closed in the saved schedule, Carla's home said "Atendimento fechado agora." and her new case received the system "Aviso" "Fora do horário de atendimento. Registramos sua mensagem…" (`25-customer-outside-hours.png`); the schedule was restored afterwards. Every earlier observation (PH-1 … PH-6.2) passed unchanged.

## Corrections during verification
- The first `verify` on the candidate failed 13 api unit tests: the outside-hours notice depends on the wall clock, and the run happened while the default schedule was closed, so every case gained a second (system) message. Fixed by saving an always-open schedule in the api unit and e2e setup (`cases.service.spec.ts`, `app.e2e-spec.ts`); the PH-5.4 e2e assertion now expects `workingDefault: false` for that reason. Tests never depend on the time of day again.
- The first smoke on the candidate failed at `email-simulated`: outside the schedule Bruno's case also received the outside-hours acknowledgement e-mail ("Recebemos sua mensagem no caso …"), so the outbox held two entries. That is intended product behavior (§4.4); the harness now counts only `staff_reply` e-mails. Also from the PH-6.2 run: the continuity locator matches the first case item only (the outbox mentions the reference too) and the privacy check asserts that Bruno sees only his own case, since he now has one.

## Final gate run
`npm run build` (shared, nest, next) exit 0 before the smoke; `npm run verify` exit 0 at commit time through the gate-then-commit script (check-context OK — ledger 3/3 with `docs/audits/CYCLE-2.md` present; lint/typecheck exit 0; Vitest shared 15/15, api 57/57, web 61/61, api e2e 30/30) — together the `full` profile on the phase candidate.

## CI
Pending push. Previous commit (PH-6.2): run 34818207797.
