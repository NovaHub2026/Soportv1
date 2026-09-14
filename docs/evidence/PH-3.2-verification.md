# PH-3.2 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-3.2 — Internal notes and specialist consultation
Recorded on: 2026-09-13 (runs 2026-09-14 01:44–01:52 UTC)
Revision: base `3fc99b0` plus the PH-3.2 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-2.3-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Internal notes are staff-only (absent from customer detail and unread counts) and do not count as customer-facing activity; consultations move the case to `waiting_internal`, assign the requester, keep the dependency across customer replies, and the last answer restores `in_progress`; double answer → 409; unknown consultation → 404 | EXECUTED (incl. negatives) | `npm test -w api` (2 new tests) | 4 files, 32 tests passed |
| 2 | HTTP: customer → 403 on notes; blank note → 400; unknown team → 400; note and question texts absent from the customer detail JSON; answer → 200, second answer → 409; staff detail lists the consultation with its answer | EXECUTED (incl. negatives) | `npm run test:e2e -w api` | 3 files, 15 tests passed. Migration `0004` (`case_consultations` + enums) applied on fresh databases |
| 3 | Web: composer mode "Nota interna" posts to `/notes` with a visibly different form; the consultation form posts `{team, question}`; the pending indicator and "Aguardando equipe interna" appear; answering posts to `/answer` and clears the pending indicator | EXECUTED | `npm test -w web` (1 new test; 1 existing test made specific) | 7 files, 37 tests passed; lint and typecheck exit 0 |
| 4 | Integrated behavior in Chromium | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-3.2` | 26 observations, exit 0: the internal note appears in the staff conversation (`14-staff-note.png`) and is absent from the customer panel after a 2 s live-update window; a consultation to Financeiro shows "1 consulta pendente" for staff and "Em análise" for the customer; the answer returns the case to "Em atendimento". Two smoke-locator ambiguities (`Resolvido`, `Equipe`) fixed with exact matches — test harness only |
| 5 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: notifications to the consulted team (no routing exists — BL-002); consultations answered by a differently-privileged role (all staff may answer today).

## Final gate run
`npm run verify`, 2026-09-14 01:51 UTC, on the completed PH-3.2 tree: `check-context: 30 documents, 407 links (2 gitignored skipped), 8 phases, 14 subphases, active: PH-3 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 32/32, web 37/37; overall exit 0. `npm run build` exit 0 on the same tree (before the smoke).

## CI
Run `34797274207` on `2562555` (PH-3.2 commit): **success** — `npm ci` and `npm run verify` green on ubuntu-latest, Node 24. Recorded 2026-09-14 01:56 UTC. Claim 6 is EXECUTED for `2562555`.
