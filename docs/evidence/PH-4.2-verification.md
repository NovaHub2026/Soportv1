# PH-4.2 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-4.2 — Record cards and contextual entry
Recorded on: 2026-09-14
Revision: base `0d8dcc9` plus the PH-4.2 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | A case opened from a record keeps its snapshot (title, status, masked facts), exposes it on the customer and staff details and in the `case_created` event; a record the adapter cannot find opens the case with `snapshot: null, lookupReason: not_found` and never leaks another customer's data; the active case per record is reported and a resolved case is no longer active | EXECUTED (incl. negatives) | `npm test -w api` (3 new tests) | 5 files, 49 tests passed |
| 2 | HTTP: staff → 403 on `/support/records`; a customer lists own records newest first with `activeCaseId` null, no raw contact in the body; unknown customer → `unavailable/not_found`; create with `record` → 201 with the card; the list then flags the record with the new case; unknown `kind` → 400; another customer's record → 201 with `lookupReason: not_found` and no leaked data; staff `/orbit` carries the record's current state and the staff detail the snapshot; migration `0008` applied on fresh databases | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (1 new test) | 3 files, 23 tests passed |
| 3 | Web: the form shows the record card, preselects the topic, sends `record` and lets the customer remove it; an active case on the record shows the continue notice, disables sending until "É outro problema", and "Continuar conversa" opens it; the host lists records and "Preciso de ajuda" opens the request about that record; the conversation shows the card or the not-found reason; staff see the detailed card and the current state | EXECUTED | `npm test -w web` (5 new tests) | 8 files, 53 tests passed; `lint` and `typecheck` exit 0 |
| 4 | Integrated behavior in Chromium (scenarios c–e of `PH-4.md`) | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-4.2` | see "Smoke" |
| 5 | Full gate on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: scenario (f) end to end in a browser (the not-found card is covered by unit, e2e and jsdom tests; PH-4.3 adds it to the smoke); a real Orbit adapter (none exists).

## Smoke
36 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-4.2/01`–`19`. New observations: `record-entry` — from the host's "Seus registros" (Simulação) the customer tapped "Preciso de ajuda: Saque 250 USDT"; the form showed the card (WD-48213) with "Depósitos e saques" preselected; sending opened SUP-000003 whose conversation shows the card with the snapshot (`18-customer-record-case.png`); `record-staff` — in the staff workspace SUP-000003 shows the card with the masked destination `TX7f…9k2Q` captured at opening and "Estado atual no Orbit: … Em processamento" (`19-staff-record-case.png`); `record-continue` — asking again about the same record showed "já tem uma conversa em andamento (SUP-000003)" and "Continuar conversa" opened it. Every earlier PH-1/PH-2/PH-3/PH-4.1 observation passed unchanged.

## Final gate run
`npm run verify`, 2026-09-14, on the completed PH-4.2 tree: exit 0 — `check-context: 57 documents, 617 links (6 gitignored skipped), 8 phases, 17 subphases, active: PH-4 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 11/11, api 49/49, web 53/53, api e2e 23/23. `npm run build` (shared, nest, next) exit 0 before the smoke.

## CI
Pending push.
