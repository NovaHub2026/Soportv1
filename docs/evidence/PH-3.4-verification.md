# PH-3.4 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-3.4 — Closure and linked follow-up
Recorded on: 2026-09-13 (runs 2026-09-14 01:58–02:15 UTC)
Revision: base `637af01` plus the PH-3.4 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-2.3-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Only `resolved` cases close; `closeExpired` closes cases past the window (system actor, `auto_window`), leaves recent and open ones, and is idempotent; staff close explicitly (`staff` reason); follow-up from a closed case creates a linked case (inherited category, system message with the previous reference, `follow_up_created` on both, `parentReference` in lists for customer and staff), is idempotent by `clientMessageId`, and is refused when the case is not closed (409) or belongs to someone else (404) | EXECUTED (incl. negatives) | `npm test -w api` (2 new tests) | 4 files, 36 tests passed |
| 2 | HTTP: close on a non-resolved case → 409; customer → 403; follow-up on a non-closed case → 409; other customer → 404; blank message → 400; valid follow-up → 201 with `parentCaseId`, `parentReference` and a system first message | EXECUTED (incl. negatives) | `npm run test:e2e -w api` | 3 files, 17 tests passed. Migration `0005` applied on fresh databases; the closure job starts with an unref'd timer and is stopped on module destroy |
| 3 | Web: the closed customer view shows the notice and a follow-up form that posts to `/follow-up` and navigates to the new case; a follow-up header shows "Continuação do caso SUP-…" with "Ver caso anterior"; staff "Encerrar caso" posts to `/close` and the composer disappears | EXECUTED | `npm test -w web` (3 new tests) | 7 files, 40 tests passed; lint and typecheck exit 0 |
| 4 | Integrated behavior in Chromium | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-3.4` | see "Smoke" |
| 5 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: the job under real elapsed time (unit test drives `closeExpired(now, windowDays)`); multi-instance scheduling (PH-8).

## Smoke
31 observations, exit 0 (2026-09-14 02:04 UTC), screenshots `screenshots/ph-3.4/`: Ana resolved and clicked "Encerrar caso" → history "Encerrado pela equipe"; the customer saw "Encerrado", the closure notice and the follow-up form instead of the composer; "Preciso de mais ajuda" opened `SUP-000002` with "Continuação do caso SUP-000001" in the header and a system message pointing back (`16-customer-follow-up.png`); the continuation appeared in the staff unassigned queue with the link to the previous case. A first run failed only on a smoke locator ambiguity (header vs system message); fixed in the harness.

## Final gate run
`npm run verify`, 2026-09-14 02:05 UTC, on the completed PH-3.4 tree: `check-context: 32 documents, 438 links (2 gitignored skipped), 8 phases, 14 subphases, active: PH-3 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 36/36, web 40/40; overall exit 0. `npm run build` exit 0 on the same tree (before the smoke).

## CI
Run `34798042328` on `426678a` (PH-3.4 commit): **success** — `npm ci` and `npm run verify` green on ubuntu-latest, Node 24. Recorded 2026-09-14 02:11 UTC. Claim 6 is EXECUTED for `426678a`.
