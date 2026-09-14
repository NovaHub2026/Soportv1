# PH-3.3 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-3.3 — Assignment and attributes
Recorded on: 2026-09-13 (runs 2026-09-14 01:53–02:05 UTC)
Revision: base `2562555` plus the PH-3.3 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-2.3-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Owner transfers with consultations/history/status preserved; another agent → Forbidden; supervisor may reassign; release returns the case to the unassigned queue with a `released` event; priority/category edits record from → to events; closed cases refuse both | EXECUTED (incl. negatives) | `npm test -w api` (2 new tests) | 4 files, 34 tests passed |
| 2 | HTTP: agent on someone else's case → 403; customer → 403; supervisor role header → 200; release → `assignedAgentId: null`; empty PATCH → 400; invalid priority → 400; valid PATCH → 200 | EXECUTED (incl. negatives) | `npm run test:e2e -w api` | 3 files, 16 tests passed |
| 3 | Web: transfer form posts `/assign`, a 403 shows the ownership message and a retry succeeds; priority select sends `PATCH {priority}`; header shows the new owner | EXECUTED | `npm test -w web` (1 new test) | 7 files, 38 tests passed; lint and typecheck exit 0 |
| 4 | Integrated behavior in Chromium | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-3.3` | see "Smoke" |
| 5 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: a real staff directory (transfer targets are the simulated agents); workload views for supervisors (PH-5).

## Smoke
28 observations, exit 0 (2026-09-14 01:55 UTC), screenshots `screenshots/ph-3.3/`: Ana transferred the case to Bruno (header "staff-bruno", history "Transferido para staff-bruno por Ana Ribeiro"), raised the priority to Alta (history "Prioridade: Normal → Alta", `15-staff-transferred.png`); switching the simulated agent to Bruno, the case was under "Meus casos" and "Devolver à fila" recorded "Devolvido à fila por Bruno Costa"; back as Ana it reappeared under "Não atribuídos" and was taken again — messages, consultations and history intact.

## Final gate run
`npm run verify`, 2026-09-14 01:56 UTC, on the completed PH-3.3 tree: `check-context: 31 documents, 422 links (2 gitignored skipped), 8 phases, 14 subphases, active: PH-3 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 34/34, web 38/38; overall exit 0. `npm run build` exit 0 on the same tree (before the smoke).

## CI
Run `34797586909` on `637af01` (PH-3.3 commit): **success** — `npm ci` and `npm run verify` green on ubuntu-latest, Node 24. Recorded 2026-09-14 02:04 UTC. Claim 6 is EXECUTED for `637af01`.
