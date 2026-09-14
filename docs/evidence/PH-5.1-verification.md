# PH-5.1 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-5.1 — Views for every state and attention signals
Recorded on: 2026-09-14
Revision: base `9c64934` plus the PH-5.1 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Waiting-for-customer, waiting-for-team, resolved and closed cases are listed in their own views; active views exclude them; `limit`/`offset` paginate; `awaitingReplySince` is set by an unanswered customer message, cleared by a staff reply or by "waiting for customer", sorts unanswered cases first, and never reaches customers | EXECUTED (incl. negatives) | `npm test -w api` (2 new tests) | 5 files, 51 tests passed |
| 2 | HTTP: `view=bogus` → 400, `limit=1000` → 400, `limit=1` → one item; a resolved case appears under `resolved` and leaves `active`; customers → 403; migration `0009` (indexes) applied on fresh databases | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (1 new test) | 3 files, 24 tests passed |
| 3 | Web: seven tabs; "Sem resposta há 3 h" on an unanswered case; the first page requests `limit=50&offset=0` | EXECUTED | `npm test -w web` (1 new test) | 8 files, 54 tests passed; `lint` and `typecheck` exit 0 |
| 4 | Integrated behavior in Chromium: the closed case is under "Encerrados" and not under "Todos ativos" | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-5.1` | see "Smoke" |
| 5 | Full gate on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: "Carregar mais" in a browser (needs > 50 cases; covered by the unit pagination test and the page arithmetic in `StaffQueue`).

## Smoke
41 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-5.1/01`–`22`. New observation `history-views`: after Ana closed SUP-000001 it is listed under "Encerrados" and no longer under "Todos ativos". A first run failed on a layout defect found by the smoke itself: the seventh tab overflowed the queue column under the conversation and could not be clicked; `.tabs` now wraps inside the column (`staff.module.css`) and the rerun passed. Every earlier observation passed unchanged.

## Final gate run
`npm run verify`, 2026-09-14, on the completed PH-5.1 tree: exit 0 — check-context OK (active: PH-5); build:shared, lint and typecheck exit 0; Vitest shared 11/11, api 51/51, web 54/54, api e2e 24/24. `npm run build` exit 0 before the smoke.

## CI
Pending push.
