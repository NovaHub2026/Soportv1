# PH-5.4 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-5.4 — Schedule and configuration, supervision overview, service metrics
Recorded on: 2026-09-14
Revision: base `c3fc6a8` plus the PH-5.4 working tree, committed as the next commit on `main` (this record travels with it — §3.4; it is also the PH-5 phase candidate).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | `computeAvailability` is open inside the configured window and closed outside it with the next opening (weekday and closed-day cases; no opening when every day is closed); settings input rejects inverted windows and a zero threshold; `durationStats` gives median/p90 with sample size and nulls without samples | EXECUTED (incl. negatives) | `npm test -w @orbit-support/shared` (`settings.test.ts`, 4 new tests) | 15 tests passed |
| 2 | An agent gets 403 on the overview and on settings updates; the overview counts unassigned, awaiting-reply, per-status and per-agent load and lists overdue cases beyond the threshold; metrics count created/resolved/reopened with first-response and resolution samples and no targets; saving settings is attributed, clears the working-default flag and changes what is overdue | EXECUTED (incl. negatives) | `npm test -w api` (1 new test) | 5 files, 53 tests passed |
| 3 | HTTP: customers read availability (working default labeled) and staff cannot; agents → 403 on overview/metrics/PUT settings; `days=999` → 400; invalid settings → 400; a supervisor's PUT is attributed and the customer availability stops being a working default; migration `0011` applied on fresh databases | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (1 new test) | 3 files, 27 tests passed |
| 4 | Web: the customer home shows "Atendimento fechado agora. Hoje: 09:00–18:00. Próximo atendimento: quinta às 09:00." and the working-default note; the supervision panel shows demand, per-agent load, the overdue list with reassignment (posts `/assign`), metrics with the no-targets note and the settings form | EXECUTED | `npm test -w web` (2 new tests) | see "Final gate run" |
| 5 | Integrated behavior in Chromium: availability copy on the home; supervisor's "Supervisão" with demand, metrics, no-targets note; saving the schedule is attributed and the customer copy switches to "Horário configurado" | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-5` | see "Smoke" |
| 6 | Full gate and production builds on the phase candidate | EXECUTED | `npm run verify:full` | see "Final gate run" |
| 7 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: reassignment from the overdue list in a browser (the smoke's data has no case older than the threshold at that moment; covered by the web test and the shared `assign` endpoint e2e); the closure job reading the configured window (unit: `followUpWindowDays()` returns the saved value; the job wiring is by reading).

## Smoke
46 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-5/01`–`23` (the PH-5 phase-candidate run). New observations: `availability` — the customer home states "Atendimento fechado agora. Hoje: 09:00–18:00. Próximo atendimento: segunda às 09:00." followed by the working-default note; `supervision` — as Carla (supervisor) "Supervisão" shows demand, load per agent, the overdue list, metrics with the explicit "no targets" note and the settings form; saving the schedule (threshold 1 h, Saturday open) records "Configurado por Carla Nunes" (`23-staff-supervision.png`); `availability-configured` — after the save the customer home says "Horário configurado (America/Sao_Paulo)". A first run failed on a harness assumption (the block reloads the home, and the next block clicked "Voltar" unconditionally); fixed and rerun. Every earlier observation passed unchanged.

## Final gate run
`npm run build` (shared, nest, next) exit 0 before the smoke; `npm run verify` exit 0 at commit time through the gate-then-commit script (check-context OK; lint/typecheck exit 0; Vitest shared 15/15, api 53/53, web 58/58, api e2e 27/27) — together the `full` profile on the phase candidate.

## CI
Commit `4b868e7`: run 34816489000 — **success**. Earlier commits of this phase: `3217c53` failure and `6d11ee8` failure (FND-0028, both corrected); `c3fc6a8` run 34815816291 **success**.
