# PH-6.2 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-6.2 — E-mail notifications through a boundary port
Recorded on: 2026-09-14
Revision: base `4136176` plus the PH-6.2 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | The job e-mails an unread notification once after the configured delay (not before), never a notification read in time, skips an opted-out customer (without retrying) and a customer whose address the boundary does not know; the outbox entry carries the reference, a masked address and the link, and never the reply text; customers only see their own outbox | EXECUTED (incl. negatives) | `npm test -w api` (1 new test) | see "Final gate run" |
| 2 | HTTP: staff → 403 on the outbox; preferences default on, invalid input → 400, toggling persists; the outbox is labeled `simulated` and never contains a raw address; migration `0013` applied on fresh databases | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (1 new test) | see "Final gate run" |
| 3 | Shared: `emailDelayMinutes` accepted from 0 | EXECUTED | `npm test -w @orbit-support/shared` | see "Final gate run" |
| 4 | Web: the home shows the preference (default on, PUT on change) and the labeled outbox whose entries open the conversation; the settings form exposes the delay | EXECUTED | `npm test -w web` (1 new test, 1 updated) | see "Final gate run" |
| 5 | Integrated behavior in Chromium: with the job at 2 s and the delay at 0, a staff reply to a customer whose panel is closed produces one simulated e-mail with the reference and no reply text; that customer's home lists it under "E-mails que seriam enviados" (Simulação) and the host shows the unread badge | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-6.2` | see "Smoke" |
| 6 | Full gate on the candidate | EXECUTED | `npm run verify` (gate-then-commit) | see "Final gate run" |
| 7 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: a real mail provider (none chosen — BL-002; PH-8); the deep link on a real Orbit host.

## Smoke
48 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-6.2/01`–`24` (failure screenshots of earlier runs removed). New observation `email-simulated`: with the notification job at 2 s and the delay at 0, a staff reply to Bruno's case (his panel closed) produced one simulated e-mail "Nova resposta no seu caso SUP-000004" to `b***@e***.com` with the link and no reply text; Bruno's home listed it under "E-mails que seriam enviados (Simulação)" and the host showed the unread badge (`24-customer-email-outbox.png`). Two harness lessons: the block was moved after the contextual-entry steps (an extra case shifted the expected references), and the first rerun exposed a real defect — see FND-0029 below. Every earlier observation passed unchanged.

**FND-0029 (MATERIAL, found by the smoke, fixed in this commit).** After Alice used "Preciso de ajuda" and the browser switched to Bruno, the re-keyed panel received the previous `entry` and showed Bruno the new-request form with Alice's withdrawal card (`failure-1.png` of that run, not kept). Contextual entries and notification opens now carry the customer id and are ignored by a panel of another customer; regression test "FND-0029" in `OrbitShell.test.tsx`. RULE-SUP-01 / §10.2 (shared device): the card came from the same browser session, not from the API, but it must never be shown to another identity.

## Final gate run
`npm run build` exit 0 before the smoke; `npm run verify` exit 0 at commit time through the gate-then-commit script (check-context OK; lint/typecheck exit 0; Vitest shared 15/15, api 55/55, web 61/61, api e2e 29/29).

## CI
Pending push. Previous commit `4136176` (PH-6.1): run 34817018198 **success**.
