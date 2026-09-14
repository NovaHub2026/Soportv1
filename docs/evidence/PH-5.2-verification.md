# PH-5.2 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-5.2 — Filters and search
Recorded on: 2026-09-14
Revision: base: the PH-5.1 commit plus the PH-5.2 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Search finds a case by reference (with or without `SUP-`, leading zeros ignored), customer id, subject words (case-insensitive) and record reference; `%` is escaped; category, priority and agent (incl. `unassigned`) filters narrow and combine with the term | EXECUTED (incl. negatives) | `npm test -w api` (1 new test) | see "Final gate run" |
| 2 | HTTP: each term finds the case under `active`; an unknown term returns `[]`; a 101-character term → 400; customers → 403 | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (1 new test) | see "Final gate run" |
| 3 | Web: the search box (debounced) and the selects send `q`, `priority` … with the list request; "Limpar" restores the plain request | EXECUTED | `npm test -w web` (1 new test) | see "Final gate run" |
| 4 | Integrated behavior in Chromium: searching `WD-48213` under "Todos ativos" lists only SUP-000003; an unknown term shows the empty state; "Limpar" restores the list | OBSERVED | smoke → `docs/evidence/screenshots/ph-5.2` | see "Smoke" |
| 5 | Full gate on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

## Smoke
SMOKE_PLACEHOLDER

## Final gate run
GATE_PLACEHOLDER

## CI
Pending push.
