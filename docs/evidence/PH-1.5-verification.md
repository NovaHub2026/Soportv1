# PH-1.5 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-1.5 — Identity boundary hardening and feature contexts
Recorded on: 2026-09-13 (runs 2026-09-14 00:48–00:55 UTC)
Revision: base `b5d3890` plus the PH-1.5 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: WSL2, Node v24.19.0, npm 11.17.0; Playwright 1.63 / Chromium 1243 with the BL-007 workaround. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Provider selection refuses unknown providers and production without opt-in; simulated provider resolves and refuses malformed/ambiguous identities | EXECUTED | `npm test -w api` (`identity.spec.ts`, 5 tests incl. negatives) | 3 files, 20 tests passed |
| 2 | `GET /api/identity/me` echoes the actor with `source: 'simulated'`; 401 without identity or with ambiguous headers | EXECUTED | `npm run test:e2e -w api` | 6 tests passed |
| 3 | API lint and typecheck | EXECUTED | `npm run lint -w api`; `npm run typecheck -w api` | exit 0 |
| 4 | Ledger control (BL-004) fails on the prohibited conditions | EXECUTED (negative) | Disposable `git worktree` of HEAD with the new checker: (a) PH-1 set to APPROVED without a ledger row; (b) ledger `3/3` without an audit record | (a) `FAIL … PH-1 is APPROVED but not counted in the audit ledger`; (b) `FAIL … cycle 1: 3 first-time approvals without an audit record — Cycle Audit is due (§6.4)`; both exit 1. Positive run on the real tree: OK |
| 5 | All workspaces build and the integrated journey passes on this tree | EXECUTED + OBSERVED | `npm run build` (shared, api, web) then `SUPPORT_DB_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-1` | build exit 0; smoke 12 observations, exit 0 at 00:51 UTC; screenshots under `screenshots/ph-1/` (phase-level evidence, see `PH-1-phase-approval.md`) |
| 6 | Feature contexts describe the code as it is | INSPECTED | Each `docs/features/*/CONTEXT.md` written from the current sources with scope paths; paths checked by `check-context` | 4 contexts: FEAT-CASE, FEAT-CHAT, FEAT-STAFF, FEAT-ORBIT; `CONTEXT_INDEX.md` rows live |
| 7 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 8 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: the production refusal at real process start (unit-tested function; the module factory calls it — INSPECTED); a real Orbit adapter (does not exist).

Limitations / reuse boundary: valid for this tree. Changes under `apps/api/src/identity/**` require claims 1–3; changes to the ledger format require claim 4 again.

## Final gate run
`npm run verify`, 2026-09-14 00:55 UTC, on the completed PH-1.5 tree: `check-context: 21 documents, 285 links (2 gitignored skipped), 8 phases, 5 subphases, active: none — OK` (ledger 1/3 consistent with CURRENT_STATE); build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 20/20, web 18/18; overall exit 0.

## CI
Run `34794245671` on `b1cc4c6` (PH-1.5 / PH-1 approval commit): **success** — `npm ci` and `npm run verify` green on ubuntu-latest, Node 24. Recorded 2026-09-14 01:07 UTC. Claim 8 is EXECUTED for `b1cc4c6`; the PH-1 phase candidate is CI verified.
