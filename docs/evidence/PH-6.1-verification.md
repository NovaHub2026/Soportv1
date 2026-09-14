# PH-6.1 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-6.1 — In-product notifications
Recorded on: 2026-09-14
Revision: base `4b868e7` plus the PH-6.1 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | One notification per customer-facing change (reply, waiting for customer, resolved, closed), none for internal notes or consultations, none for a retried reply; opening the case marks them read; another customer sees and marks nothing | EXECUTED (incl. negatives) | `npm test -w api` (1 new test) | see "Final gate run" |
| 2 | HTTP: staff → 403; own list with `unread` count and no message text; another customer's list empty and their mark attempt changes nothing; invalid ids → 400; marking all → `unread: 0`; migration `0012` applied on fresh databases | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (1 new test) | see "Final gate run" |
| 3 | Web: the host badge shows the unread count and clicking a notification opens the conversation | EXECUTED | `npm test -w web` (1 new test) | see "Final gate run" |
| 4 | Integrated behavior in Chromium: the staff reply creates "Nova resposta em SUP-000001"; with the conversation on screen it is read at once and no badge appears | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-6.1` | see "Smoke" |
| 5 | Full gate on the candidate | EXECUTED | `npm run verify` (gate-then-commit) | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: a badge appearing while the panel is closed in a real browser (the smoke keeps the conversation open; the unit and web tests cover the unread path).

## Smoke
47 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-6.1/01`–`23`. New observation `notification`: right after the live staff reply, the host's "Notificações" list contained "Nova resposta em SUP-000001"; because the conversation was on screen the notification was already read and no badge appeared. Every earlier observation passed unchanged.

## Final gate run
`npm run build` exit 0 before the smoke; `npm run verify` exit 0 at commit time through the gate-then-commit script (check-context OK; lint/typecheck exit 0; Vitest shared 15/15, api 54/54, web 59/59, api e2e 28/28).

## CI
Pending push. Previous commit `4b868e7` (PH-5.4): run 34816489000 **success**.
