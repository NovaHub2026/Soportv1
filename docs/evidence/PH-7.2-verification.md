# PH-7.2 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-7.2 — Roles and permissions
Recorded on: 2026-09-14
Revision: base `968ae88` plus the PH-7.2 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Shared: `staffMay` lets agents act on their own or unowned cases, opens replies, internal notes and consultation answers to any staff, refuses state changes on a colleague's case, and lets supervisors/admins do everything; `caseOwnership` derives own/unowned/other | EXECUTED | `npm test -w @orbit-support/shared` (`identity.test.ts`) | 21 tests passed |
| 2 | Service: on Ana's case, Bruno (agent) may reply, note and answer a consultation without becoming responsible, and gets 403 on status, consultation request, attributes, resolution, incident link and closure; the owner and the supervisor may; every earlier behaviour unchanged | EXECUTED | `npm test -w api` (`cases.service.spec.ts` "role model") | 63 tests passed |
| 3 | Identity: only directory members resolve as staff (unknown id → nobody); the directory's role wins over the header (a header "supervisor" on an agent is ignored) | EXECUTED | `npm test -w api` (`identity.spec.ts`) | passed (within claim 2) |
| 4 | HTTP: a non-owner agent → 403 on status, resolve, PATCH and consultations, 201 on a reply that leaves the owner unchanged; a header role cannot promote an agent; the supervisor → 200; an unknown staff id → 401 on `/api/staff/cases` and `/api/identity/me`; every earlier contract unchanged | EXECUTED | `npm run test:e2e -w api` (PH-7.2 test) | 32 tests passed |
| 5 | Web: an agent viewing a colleague's case sees the state actions disabled with the reason and can still reply; a supervisor sees them enabled; a 403 from the API is explained, not "try again" | EXECUTED | `npm test -w web` (`StaffWorkspace.test.tsx` PH-7.2) | 70 tests passed |
| 6 | Integrated behaviour in Chromium: every PH-1..PH-7.1 journey passes under the enforced role model (the simulated staff act within their roles) | OBSERVED | `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-7.2` after `npm run build` | see "Smoke" |
| 7 | `check-context` no longer skips missing paths because of the `git check-ignore` trailing-slash quirk (FND-0057); the two stale links it then exposed are repaired | EXECUTED | `node scripts/check-context.mjs` (part of `verify`) | see "Final gate run" |
| 8 | Full gate on the candidate | EXECUTED | `npm run gate` | see "Final gate run" |
| 9 | CI executes the gate and the builds on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: a browser observation of a refused action (the smoke's staff act within their roles; the disabled state and the 403 copy are covered by the web tests); real staff accounts and revocation (Orbit's policies, §10.2).

## Smoke
52 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-7.2/01`–`27`. New observation `role-model`: once Ana transferred the case to Bruno, her workspace showed "Só o responsável ou um supervisor…" and "Resolver caso" disabled (`15-staff-transferred.png`). Harness change forced by the rule itself: the first run failed because Ana raised the priority after transferring the case to Bruno (now 403 — the rule working); the priority edit moved before the transfer. Every other journey (take, reply, status, consultation by the owner, transfer by the owner, supervisor reassignment, incidents) passed unchanged.

## Corrections during verification
- The fixed checker (FND-0057) exposed two references the quirk had hidden since Cycle 1: the architecture directory `docs/architecture/` (pending) in `docs/audits/CYCLE-1.md` (now marked pending there, as the index already did) and a relative src mention in `docs/evidence/PH-1.1-verification.md` (prose, no longer formatted as a path). No other document was affected.

## Final gate run
`npm run build` (shared, nest, next) exit 0 before the smoke; `npm run verify` exit 0 at commit time through `scripts/gate-commit.sh` (check-context OK with the repaired `gitIgnored`; lint/typecheck exit 0; Vitest shared 21/21, api 63/63, web 70/70, api e2e 32/32).

## CI
Commit `db67f04`: run 34824747416 — **success**. Previous commit `968ae88` (PH-7.1): run 34823601278 **success**.
