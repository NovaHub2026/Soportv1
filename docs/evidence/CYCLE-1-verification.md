# Cycle Audit 1 — Remediation verification evidence
Type: VERIFICATION EVIDENCE
Work item: Cycle Audit 1 remediation (`docs/audits/CYCLE-1.md`, findings FND-0006..FND-0022)
Recorded on: 2026-09-14
Revision: base `11f178a` plus the remediation working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: Windows 11 Pro 10.0.26200 (native, Git Bash), Node v24.19.0, npm 11.17.0, fresh `npm ci` on this host; Playwright 1.63 with Chromium installed by `npx playwright install chromium`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Customer responses and customer streams carry no staff-only field (FND-0006); transfers to unknown agents are refused (FND-0007); resolution waits for open consultations and closed cases accept no answer (FND-0008); concurrent takes and overlapping closures write one assignment / one closure (FND-0009); idempotency keys are per case and author and creation keys never answer with another case (FND-0010); every exit from resolved records a reopening (FND-0013) | EXECUTED (incl. negatives) | `npm test -w api` (7 new tests, "Cycle Audit 1 regressions") | 4 files, 44 tests passed |
| 2 | HTTP: listing creates nothing; NUL bytes → 400 (FND-0016); `unknown_agent` → 400; customer JSON without staff-only keys while the staff view shows them; `consultations_open` → 409; customer streams carry the projection (FND-0006); exactly 10 MiB accepted, one byte more → 413, accents preserved, closed case → 409 (FND-0017); migration `0007` applied on fresh databases | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (3 new tests) | 3 files, 21 tests passed |
| 3 | Shared: `toCustomerCaseSummary` strips every `STAFF_ONLY_SUMMARY_FIELDS` entry; text schemas refuse NUL | EXECUTED | `npm test -w @orbit-support/shared` | 9 tests passed |
| 4 | Web: a poll started before a send never hides it (FND-0002 regression); a case that stops being the customer's is cleared and nothing is retried, switching the simulated customer resets the panel (FND-0011); 409 `case_closed` moves the text into the follow-up form, 4xx are refused and never auto-retried, failed sends survive unmount/remount (FND-0012); no read receipt while hidden, one when shown (FND-0021) | EXECUTED | `npm test -w web` (6 new tests, new `OrbitShell.test.tsx`) | 8 files, 47 tests passed; `lint` and `typecheck` exit 0 |
| 5 | Production guard is case-insensitive (FND-0018) | EXECUTED | `apps/api/src/identity/identity.spec.ts` | passed (within claim 1) |
| 6 | `multer` resolves to 2.3.0 and production dependencies audit clean (FND-0020) | EXECUTED | `npm ls multer` → `multer@2.3.0 overridden`; `npm audit --omit=dev` → `found 0 vulnerabilities` | as stated |
| 7 | Schema and migrations agree after `0007` | EXECUTED | `npx drizzle-kit generate` after the change produced only `0007`; a second run: "No schema changes, nothing to migrate" | no drift |
| 8 | Full gate and production builds on the remediated tree | EXECUTED | `npm run verify:full` | see "Final gate run" |
| 9 | Integrated behavior in Chromium after remediation (every PH-1/PH-2/PH-3 journey still passes) | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/cycle-1` | see "Smoke" |
| 10 | CI executes the gate (now incl. e2e) on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: the race fixes against a server PostgreSQL (BL-019); mobile-layout read receipts in a real browser (jsdom only); load behaviour of the SSE cap that is not yet implemented (BL-012).

## Smoke
32 observations, exit 0 (2026-09-14, after the harness fix below), screenshots `screenshots/cycle-1/01`–`17`: every PH-1, PH-2 and PH-3 journey passed on the remediated build — live delivery 78 ms staff → customer and 59 ms customer → staff, offline send resent once, internal note and incident broadcast absent from the customer panel after a live-update window, consultation → "Em análise" → back to "Em atendimento", transfer/release/retake with history, resolve/reopen, close → linked follow-up, privacy on customer switch, mobile layout. The transfer step used `staff-bruno`, a directory member, so FND-0007's validation did not interfere.
Harness fix (FND-0019, portability): the first attempt on this Windows host exited without running because `scripts/ui-smoke.mjs` spawned the `.bin/next` shell shim (ENOENT) and its process-group shutdown relies on POSIX signals; the script now spawns Next's JS entry with `process.execPath`, stops children with `taskkill /T` on Windows and fails loudly (exit 3) when a server cannot start.

## Final gate run
`npm run verify:full` on the completed remediation tree (before the documentation edits): exit 0 — check-context OK; build:shared, lint (oxlint api, eslint web) and typecheck exit 0; Vitest shared 9/9, api 44/44, web 47/47, api e2e 21/21; `npm run build` (shared, nest, next) exit 0.
`npm run verify` again after the documentation edits, 2026-09-14: exit 0 — `check-context: 52 documents, 553 links (6 gitignored skipped), 8 phases, 14 subphases, active: none — OK` (ledger cycle 1 3/3 closed, cycle 2 0/3); shared 9/9, api 44/44, web 47/47, e2e 21/21.

## CI
Pending push. Record the verdict of the run for this commit here (`gh run list --limit 3`).
