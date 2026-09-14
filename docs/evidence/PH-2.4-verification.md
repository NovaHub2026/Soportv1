# PH-2.4 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-2.4 — Reliability evidence and phase closure
Recorded on: 2026-09-13 (runs 2026-09-14 01:32–01:40 UTC)
Revision: base `88ee96c` plus the PH-2.4 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-2.3-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Three concurrent sends with one `clientMessageId` store exactly one message and every caller receives the same id (customer and staff) | EXECUTED | `npm test -w api` (new test in `cases.service.spec.ts`) | First run **failed** with `duplicate key value violates unique constraint "case_messages_author_client_message_uq"` surfacing as an error to the losing caller — **FND-0005** (MATERIAL). After `onceByClientMessageId`: 4 files, 27 tests passed |
| 2 | Conversation resyncs (re-reads) on every `connected` and renders a message pushed twice only once | EXECUTED | `npm test -w web` (new test in `CaseConversation.test.tsx`) | 7 files, 34 tests passed |
| 3 | API e2e still green after the fix | EXECUTED | `npm run test:e2e -w api` | 3 files, 13 tests passed; lint and typecheck exit 0 |
| 4 | Integrated journey on the phase candidate | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-2` | see `PH-2-phase-approval.md` (20 observations) |
| 5 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: real-network partitions and multi-instance deployments (ADR-0004 limitation, PH-8).

## Final gate run
`npm run verify`, 2026-09-14 01:34 UTC, on the completed PH-2.4 tree: `check-context: 27 documents, 378 links (2 gitignored skipped), 8 phases, 9 subphases, active: none — OK` (ledger 2/3 consistent with CURRENT_STATE); build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 27/27, web 34/34; overall exit 0. `npm run build` exit 0 on the same tree (before the smoke).

## CI
Run `34796413346` on `8a5f211` (PH-2.4 / PH-2 approval commit): **success** — `npm ci` and `npm run verify` green on ubuntu-latest, Node 24. Recorded 2026-09-14 01:43 UTC. Claim 6 is EXECUTED for `8a5f211`; the PH-2 phase candidate is CI verified.
