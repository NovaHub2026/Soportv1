# PH-3.1 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-3.1 — Status transitions and resolution
Recorded on: 2026-09-13 (runs 2026-09-14 01:36–01:50 UTC)
Revision: base `8a5f211` plus the PH-3.1 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-2.3-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Staff transitions (waiting for customer / internal / resume) take responsibility for unowned cases and record events; customer replies follow §7.2 (return to active vs. keep the internal dependency); resolve posts a public explanation, sets reason/timestamps and an event; re-resolve → 409; customer reply reactivates and clears the reason; closed cases refuse transitions | EXECUTED (incl. negatives) | `npm test -w api` (3 new tests) | 4 files, 30 tests passed |
| 2 | HTTP: customer → 403 on staff transitions; `status: resolved` → 400 (not a direct target); blank explanation → 400; resolve → 200 with reason; second resolve → 409; the customer detail shows the explanation as the last message | EXECUTED (incl. negatives) | `npm run test:e2e -w api` | 3 files, 14 tests passed. Migration `0003` (`ALTER TYPE … ADD VALUE` ×8, `resolution_reason`) applied on fresh in-memory databases in every test |
| 3 | Web: status buttons call `POST …/status`; the resolution form sends `{reason, explanation}` and the header shows "Resolvido · Dúvida respondida"; the customer's resolved notice button sends "Ainda preciso de ajuda." and the status returns to "Em atendimento" | EXECUTED | `npm test -w web` (2 new tests) | 7 files, 36 tests passed; lint and typecheck exit 0 |
| 4 | Integrated lifecycle in Chromium | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-3.1` | see "Smoke" below |
| 5 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

## Smoke
23 observations, exit 0 (2026-09-14 01:42 UTC), screenshots `screenshots/ph-3.1/`: all PH-1/PH-2 steps plus — staff "Aguardar cliente" → customer saw "Aguardando sua resposta", replied, staff saw "Em atendimento"; staff resolved with "Problema resolvido" and an explanation → customer saw "Resolvido", the explanation and the "Ainda preciso de ajuda" button (`13-customer-resolved.png`); staff header "Resolvido · Problema resolvido" and history "Resolvido: Problema resolvido"; the button reactivated the case — "Em atendimento" on both sides and "Reaberto pelo cliente" in the history. A first run failed only on a smoke locator ambiguity (`Resolvido` matched the notice text case-insensitively); fixed with an exact match.

## Final gate run
`npm run verify`, 2026-09-14 01:43 UTC, on the completed PH-3.1 tree: `check-context: 29 documents, 392 links (2 gitignored skipped), 8 phases, 14 subphases, active: PH-3 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 30/30, web 36/36; overall exit 0. `npm run build` exit 0 on the same tree (before the smoke).

## CI
Run `34796862416` on `3fc99b0` (PH-3.1 commit): **success** — `npm ci` and `npm run verify` green on ubuntu-latest, Node 24. Recorded 2026-09-14 01:51 UTC. Claim 6 is EXECUTED for `3fc99b0`.
