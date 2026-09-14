# PH-4.1 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-4.1 — Orbit records boundary and customer summary
Recorded on: 2026-09-14
Revision: base `85dc567` plus the PH-4.1 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `CYCLE-1-verification.md` (Windows 11 native, Node v24.19.0, npm 11.17.0, Playwright Chromium). Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | `maskEmail` / `maskPhone` keep only a recognizable fragment (context §10.2) | EXECUTED | `npm test -w @orbit-support/shared` (`orbit.test.ts`, 2 new tests) | 11 tests passed |
| 2 | The simulated adapter answers a masked, `source: 'simulated'` summary for a simulated customer, `not_found` for an unknown one and `unavailable` in outage mode; the serialized answer never contains the raw e-mail or phone | EXECUTED (incl. negatives) | `npm test -w api` (`orbit-records.spec.ts`, 2 new tests) | 5 files, 46 tests passed |
| 3 | HTTP: `GET /api/staff/cases/:id/orbit` → 403 for a customer, 404 for an unknown case, 200 `available` with `emailMasked: a***@e***.com` and no raw contact in the body, 200 `unavailable/not_found` for a customer the adapter does not know, 200 `unavailable/unavailable` with `SUPPORT_SIMULATED_ORBIT=unavailable`; `/api/health` reports `orbitRecords: simulated` | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (1 new test) | 3 files, 22 tests passed |
| 4 | Web: the context column shows the summary (username, masked e-mail, "Verificada", "Conta real") labeled Simulação and never the raw domain; an unavailable lookup shows "Dados do Orbit indisponíveis: Orbit sem resposta." with "Tentar novamente", which re-reads | EXECUTED | `npm test -w web` (1 test updated, 1 new) | 8 files, 48 tests passed; `lint` and `typecheck` exit 0 |
| 5 | Integrated behavior in Chromium: staff see the Orbit summary in the real staff workspace | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-4.1` | see "Smoke" |
| 6 | Full gate on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 7 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: the unavailable state in a real browser (jsdom only — the smoke runs the adapter in its normal mode); a real Orbit adapter (none exists, DEC-0003).

## Smoke
33 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-4.1/01`–`17`. New observation `orbit-summary`: after Ana takes SUP-000001, the context column shows "Cliente no Orbit" (badge Simulação) with username alice.souza, e-mail masked as `a***@e***.com`, verification "Verificada" and "Conta real"; the smoke fails if the raw e-mail domain is rendered (it was not). `09-staff-case-reply.png` shows the section; every PH-1/PH-2/PH-3 observation of the previous run passed unchanged.

## Final gate run
`npm run verify`, 2026-09-14, on the completed PH-4.1 tree: exit 0 — `check-context: 55 documents, 594 links (6 gitignored skipped), 8 phases, 17 subphases, active: PH-4 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 11/11, api 46/46, web 48/48, api e2e 22/22. `npm run build` (shared, nest, next) exit 0 before the smoke.

## CI
Pending push.
