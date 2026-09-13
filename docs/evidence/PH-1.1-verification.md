# PH-1.1 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-1.1 — Workspace scaffold and verification gate
Recorded on: 2026-09-13
Revision: base commit `4da2ac2` (adoption) plus the PH-1.1 working tree, committed as the next commit on `main`. This record travels inside that commit, so it names the base plus the attributable change, not its own hash (`GOVERNANCE.md` §3.4).
Environment: WSL2 (Linux 6.18), Node v24.19.0, npm 11.17.0, fresh `npm install` at the root. Same machine for every run below; runs were sequential, no concurrent edits to the checked scope during a run.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | `check-context` fails on a missing referenced path (negative case, §7.3) | EXECUTED | `node scripts/check-context.mjs` before `docs/runbooks/VERIFICATION.md` and `docs/phases/PH-1.1.md` existed | exit 1; 2 findings: `CURRENT_STATE.md` → `docs/phases/PH-1.1.md`, `docs/phases/PH-1.md` → `docs/runbooks/VERIFICATION.md` |
| 2 | `check-context` stops the gate before later layers run | EXECUTED | `npm run verify:full`, first attempt | exit 1 at the context layer with 2 findings (a relative `src/` mention in PH-1.1.md and a not-yet-existing `docs/evidence/`); lint/typecheck/test/build did not run |
| 3 | Lint passes in both apps | EXECUTED | `npm run lint` — oxlint (api), ESLint (web) | exit 0 |
| 4 | Typecheck passes in both apps | EXECUTED | `npm run typecheck` — `tsc --noEmit` (api); `next typegen && tsc --noEmit` (web) | exit 0. First attempt failed with TS2307 on `supertest/types` in the Nest scaffold's e2e spec (nodenext + TypeScript 6); fixed by dropping that import and the `App` generic |
| 5 | Unit tests are discovered and pass in both apps | EXECUTED | `npm test` — Vitest 4.1.11 | api: 1 file, 1 test passed; web (jsdom): 1 file, 1 test passed; exit 0 |
| 6 | Production builds succeed | EXECUTED | `npm run build` — `nest build`, `next build` | exit 0; `apps/api/dist/` and `apps/web/.next/` produced (ignored by Git) |
| 7 | API e2e profile runs | EXECUTED | `npm run test:e2e --workspace api` — Vitest + supertest | 1 file, 1 test passed; exit 0 |
| 8 | Full gate passes on the completed candidate | EXECUTED | `npm run verify` after all PH-1.1 documents existed | see "Final gate run" below |
| 9 | CI executes the same gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml`, push to `main` | awaiting corroboration — see "CI" below |

Output: claims 1–2 reproduced in the Result column; claims 3–7 summarized from terminal output of this session (full logs not committed).

Not verified: e2e profile is not part of CI (deliberate, see runbook); no browser/e2e UI tests exist; "Vitest fails on empty discovery" is INSPECTED from Vitest defaults (`passWithNoTests` unset), not exercised.

Limitations / reuse boundary: valid for this tree only. Any change to `package.json` files, `tsconfig*.json`, Vitest/ESLint/oxlint configuration, `scripts/check-context.mjs` or the live context documents requires rerunning the affected profile.

## Final gate run
`npm run verify`, 2026-09-13 23:38 UTC, on the completed PH-1.1 tree (PH-1.1 still `ACTIVE` at that moment):
`check-context: 12 documents, 73 links, 8 phases, 5 subphases, active: PH-1 / PH-1.1 — OK`; lint exit 0; typecheck exit 0; Vitest api 1/1 and web 1/1 passed; overall exit 0.
The approval-only metadata edits that followed (statuses, state, handoff, index, log) were checked with `npm run check:context` — result recorded in the commit message of the PH-1.1 commit and in `SESSION_HANDOFF.md`.

## CI
Pending push.
