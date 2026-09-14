# PH-4.3 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-4.3 — Unavailable and not-found flows, masking review, phase closure
Recorded on: 2026-09-14
Revision: base `4c06c5c` plus the PH-4.3 working tree, committed as the next commit on `main` (this record travels with it — §3.4; it is also the PH-4 phase candidate).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | The staff Orbit section lists the subjects not served by the boundary yet with the `not_integrated` reason | EXECUTED | `npm test -w web` (assertion added to the PH-4.1 test) | 8 files, 53 tests passed; `lint` and `typecheck` exit 0 |
| 2 | Scenario (f): a case about a record the simulated Orbit cannot find is opened through the API, and both the customer and staff see "Registro não encontrado no Orbit…" on the card; staff also see "Estado atual indisponível" and the not-integrated list | OBSERVED | browser smoke (`record-not-found`, `record-not-found-staff`) | see "Smoke" |
| 3 | Scenario (b): with the API restarted in outage mode on the same data, staff see "Dados do Orbit indisponíveis: Orbit sem resposta." with "Tentar novamente", the host says "Registros indisponíveis no momento.", and the customer still opens SUP-000003 with the snapshot card | OBSERVED | browser smoke (`orbit-outage-staff`, `orbit-outage-customer`) | see "Smoke" |
| 4 | Masking review: no surface renders anything the adapter did not already mask; the customer projection strips staff-only fields; the `case_created` event carries no record data | INSPECTED | reading `simulated-orbit-records.ts`, `RecordCard.tsx`, `OrbitCustomerSection.tsx`, `cases.service.ts` (`captureRecord`, `toCaseRecord`, `case_created` data), plus the e2e negatives of PH-4.1/PH-4.2 (`not.toContain('example.com')`, `'99999'`, `'Saque 250'` for a foreign customer) | consistent — see `PH-4-phase-approval.md` "Masking" |
| 5 | Full gate and production builds on the phase candidate | EXECUTED | `npm run verify:full` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: network-level timeouts (no adapter produces `timeout` yet); a real Orbit adapter (none exists — DEC-0003).

## Smoke
40 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-4/01`–`22` (the PH-4 phase-candidate run). New observations: `record-not-found` — a case created about `WD-000000` (SUP-000004) shows "Registro não encontrado no Orbit… A equipe vai investigar." on the customer card (`20-customer-record-not-found.png`); `record-not-found-staff` — staff see the same card, "Estado atual indisponível" and the "Ainda não integrado" list; `orbit-outage-staff` — after the API restarted with `SUPPORT_SIMULATED_ORBIT=unavailable` on the same data, SUP-000003 shows "Dados do Orbit indisponíveis: Orbit sem resposta." with "Tentar novamente" while the conversation and the snapshot card (`TX7f…9k2Q`) stay readable (`21-staff-orbit-outage.png`); `orbit-outage-customer` — the host says "Registros indisponíveis no momento." and the customer still opens SUP-000003 with the snapshot card (`22-customer-orbit-outage.png`). The web proxy logged the expected ECONNRESET on the open streams during the restart; the pages reconnected. Every earlier observation (PH-1 … PH-4.2) passed unchanged.

## Final gate run
`npm run verify:full`, 2026-09-14, on the completed PH-4.3 tree (phase candidate): exit 0 — `check-context: 60 documents, 645 links (6 gitignored skipped), 8 phases, 17 subphases, active: none — OK` (ledger cycle 2: 1/3); build:shared, lint and typecheck exit 0; Vitest shared 11/11, api 49/49, web 53/53, api e2e 23/23; `npm run build` (shared, nest, next) exit 0.

## CI
Pending push.
