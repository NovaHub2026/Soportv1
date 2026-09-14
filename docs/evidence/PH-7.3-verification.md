# PH-7.3 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-7.3 — Shared-device sign-out, idle sign-out, privacy re-check, phase closure
Recorded on: 2026-09-14
Revision: base `db67f04` plus the PH-7.3 working tree, committed as the next commit on `main` (this record travels with it — §3.4; it is also the PH-7 phase candidate).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Web: "Sair" on the host leaves a neutral picker with no case, notification, bell, record or draft of the previous customer; the remembered selection and every `orbit-support.` session buffer are gone; the recovery link stays; "Entrar" as another customer starts clean; the host signs out by itself after the idle timeout and says why | EXECUTED | `npm test -w web` (`OrbitShell.test.tsx` PH-7.3 ×2) | 73 tests passed |
| 2 | Web: the staff workspace's "Sair" forgets the agent, shows the neutral picker without queues, and "Entrar" as Carla shows the supervisor button | EXECUTED | `npm test -w web` (`StaffWorkspace.test.tsx` PH-7.3) | passed (within claim 1) |
| 3 | HTTP privacy re-check under the role model: an internal note by a non-owner, a consultation question and answer, an incident title and its broadcast note never appear in the customer detail, list, notifications or outbox; nor do `incidentId`, `assignedAgentId`, `staffLastReadAt`; another customer → 404; the staff view keeps the material | EXECUTED | `npm run test:e2e -w api` (PH-7.3 test) | 33 tests passed |
| 4 | Every earlier api behaviour unchanged | EXECUTED | `npm test -w api` (part of `verify`) | 63 tests passed |
| 5 | Integrated behaviour in Chromium: sign-out on both surfaces (reload keeps the neutral state) and every PH-1..PH-7.2 journey | OBSERVED | `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-7` after `npm run build` | see "Smoke" |
| 6 | Full gate and production builds on the phase candidate | EXECUTED | `npm run gate` + `npm run build` | see "Final gate run" |
| 7 | CI executes the gate and the builds on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: the idle timeout in a browser (30 minutes cannot elapse in the smoke; unit-tested with fake timers); the customer stream after the role model (the projection is unchanged since Cycle Audit 1 and e2e asserts the detail/list shapes); attachments across roles were not re-probed (unchanged since Cycle Audit 1, FND-0017).

## Smoke
54 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-7/01`–`29` (the PH-7 phase-candidate run). New observations `sign-out` (after "Sair" only "Quem está usando este dispositivo?" remains, with the recovery link; nothing of Alice survives a reload — `28-signed-out.png`) and `staff-sign-out` (the workspace's "Sair" leaves "Quem está usando esta estação?" without queues — `29-staff-signed-out.png`); both surfaces sign back in inside the block so later steps keep working. Every earlier observation (PH-1 … PH-7.2) passed unchanged.

## Final gate run
`npm run build` (shared, nest, next) exit 0 before the smoke; `npm run verify` exit 0 at commit time through `scripts/gate-commit.sh` (check-context OK — ledger cycle 3 at 1/3; lint/typecheck exit 0; Vitest shared 21/21, api 63/63, web 73/73, api e2e 33/33).

## CI
Commit `f6ae3f4`: run 34825250815 — **success**. Previous commit `db67f04` (PH-7.2): run 34824747416 **success**.
