# PH-3.5 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-3.5 — Shared incidents and phase closure
Recorded on: 2026-09-13 (runs 2026-09-14 02:06–02:20 UTC)
Revision: base `426678a` plus the PH-3.5 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-2.3-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Cases link to an open incident (event with title), broadcast notes reach only linked open cases as internal notes (absent from the customer view), resolving the incident leaves case statuses untouched and adds an internal advisory note, resolved incidents cannot be linked to (409), unlink works, unknown incident → 404 | EXECUTED (incl. negatives) | `npm test -w api` (1 new test) | 4 files, 37 tests passed |
| 2 | HTTP: customer → 403 on incidents; short title → 400; create/link/list (`linkedCaseCount`)/broadcast (`delivered`)/resolve → 2xx; unknown status filter → 400; the broadcast text is absent from the customer's messages; the case stays `new` after the incident is resolved | EXECUTED (incl. negatives) | `npm run test:e2e -w api` | 3 files, 18 tests passed. Migration `0006` applied on fresh databases |
| 3 | Web: "Criar incidente" creates and links; the broadcast form posts and reports the delivered count; "Marcar incidente como resolvido" posts and the case status badge stays "Novo" | EXECUTED | `npm test -w web` (1 new test) | 7 files, 41 tests passed; lint and typecheck exit 0 |
| 4 | Integrated behavior in Chromium (also the PH-3 phase candidate run) | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-3` | see "Smoke" |
| 5 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: incidents with dozens of linked cases (broadcast is sequential; fine at current scale); customer-facing incident notices (PH-6).

## Smoke
32 observations, exit 0 (2026-09-14 02:11 UTC), screenshots `screenshots/ph-3/` (also the PH-3 phase-candidate run): from SUP-000002 Ana created and linked the incident "Atraso no provedor Pix" (history "Incidente: Vinculado ao incidente …"), broadcast an internal note (delivered to 1 case, visible in the staff conversation, absent from the customer panel after a live-update window), marked the incident resolved (advisory internal note posted) and the case stayed "Novo" (`17-staff-incident.png`). All PH-1/PH-2/PH-3 steps passed in the same run.

## Final gate run
`npm run verify`, 2026-09-14 02:13 UTC, on the completed PH-3.5 tree: `check-context: 33 documents, 471 links (2 gitignored skipped), 8 phases, 14 subphases, active: none — OK` (ledger 3/3 with the audit record present); build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 37/37, web 41/41; overall exit 0. `npm run build` exit 0 on the same tree (before the smoke).

## CI
Pending push.
