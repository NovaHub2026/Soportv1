# PH-5.3 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-5.3 — Saved replies (record shared with PH-5.2, committed together)
Recorded on: 2026-09-14
Revision: base `3217c53` plus the PH-5.2 and PH-5.3 working tree, committed together as the next commit on `main` (this record travels with it — §3.4). This commit also restores a consistent tree after FND-0028 (see `PH-5.1-verification.md`).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | HTTP: customers → 403; empty title → 400; any staff creates (attributed); another agent cannot edit or remove (403); a supervisor edits (attributed, category cleared when omitted); the author removes (204); a removed reply → 404; migration `0010` applied on fresh databases | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (1 new test; plus the PH-5.2 search test) | see "Final gate run" |
| 2 | Web: the composer picker inserts the saved text into the draft without sending; the management panel lists, creates, edits and removes (panel exercised by reading and in the smoke through the API-created reply) | EXECUTED | `npm test -w web` (1 new test; plus the PH-5.2 filter test) | see "Final gate run" |
| 3 | Integrated behavior in Chromium: a saved reply created by a supervisor is offered in Ana's composer and inserted into the draft, editable, nothing sent; search narrows the list and "Limpar" restores it | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-5.3` | see "Smoke" |
| 4 | Full gate on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 5 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

## Smoke
SMOKE_PLACEHOLDER

## Final gate run
GATE_PLACEHOLDER

## CI
Pending push.
