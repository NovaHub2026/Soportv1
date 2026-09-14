# PH-9.4 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-9.4 — Operations and process debt (BL-026, BL-009, BL-023, BL-030) and the PH-9 phase candidate
Recorded on: 2026-09-14
Revision: base `3339aef` plus the PH-9.4 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: Windows 11 native, Git Bash, Node v24.19.0, npm 11.17.0, Playwright Chromium (headless), Docker Engine 29.8.0 (PostgreSQL 16 test container on 127.0.0.1:55433). Browser runs and probes used scratch databases and the built apps (API on 3001, web on 3150/3152).

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Recovery service: 10 requests from one client address accepted, the 11th → 429 `too_many_from_client` with `retryAfterSeconds`; a retried accepted request is answered; another address is unaffected; 11 minutes later the first address is accepted again | EXECUTED | `npm test -w api` (`access-recovery.service.spec.ts`) | 87 tests passed |
| 2 | `SUPPORT_TRUST_PROXY`: unset, blank, `0`, `false`, `off` and invalid values trust no proxy; `1`/`2` are hop counts | EXECUTED | `npm test -w api` (`app.setup.spec.ts`) | passed (within claim 1) |
| 3 | Uploads never linked: after 24 h an abandoned case upload and a staged upload are removed with their bytes; a linked and a recent upload stay; a second run removes nothing | EXECUTED | `npm test -w api` (`cases.service.spec.ts`, PH-9.4) | passed (within claim 1) |
| 4 | `AttachmentCleanupJob.tick()`: single flight, logged failure, interval only when enabled, stops on shutdown | EXECUTED | `npm test -w api` (`jobs.spec.ts`, 3 more tests) | passed (within claim 1) |
| 5 | HTTP, with the e2e file playing a deployment behind one appending proxy (`SUPPORT_TRUST_PROXY=1`): the per-contact 429 carries `Retry-After` equal to the body's hint; the 11th request from `X-Forwarded-For: 203.0.113.7` → 429 `too_many_from_client` with `Retry-After`; `203.0.113.8` → 201; every earlier contract unchanged | EXECUTED | `npm run test:e2e -w api` | 37 tests passed |
| 6 | The recovery form names the connection for `too_many_from_client` ("desta conexão", "9 min") and never the contact | EXECUTED | `npm test -w web` (`AccessRecoveryForm.test.tsx`) | 89 tests passed |
| 7 | First per-client design disproved: with one trusted hop by default, through the built web the 11th IPv4 request was refused, but a request carrying a forged `X-Forwarded-For` was accepted and the first IPv6 request was refused — Next's rewrite proxy neither adds the browser's address nor drops a forged one, so every client shared one bucket and a forged header escaped it | OBSERVED | scratch probe through the web (not committed, §11) | design changed (DEC-0038 b): no proxy trusted unless configured |
| 8 | Final design, loopback topology (`SUPPORT_TRUST_PROXY` unset): 11 requests from 127.0.0.1 → all 201, forged header → 201, ::1 → 201 (no per-client refusal); 4 requests for one contact → the 4th 429 `too_many_requests` with `Retry-After: 3600` equal to the body, through the web | OBSERVED | scratch probe | as stated |
| 9 | Final design, hosted shape (a scratch reverse proxy that appends `X-Forwarded-For` in front of the web, `SUPPORT_TRUST_PROXY=1`): 10 × 201 then 429 `too_many_from_client` for 127.0.0.1; a forged `X-Forwarded-For` from 127.0.0.1 → 429 (does not escape); ::1 → 201 (another client) | OBSERVED | scratch probe | as stated |
| 10 | Checker, positive: the real tree passes with the new rules (paths inside command spans, cited commits and tags, ledger record parsing) | EXECUTED | `npm run check:context` | OK at commit time |
| 11 | Checker, negative (§7.3): in disposable worktrees of `3339aef` with the new checker, a missing path inside a command span, an unknown commit and an unknown tag each fail; a cycle at 3/3 whose record cell names the out-of-band audit fails with "an out-of-band audit record does not discharge the due Cycle Audit"; the worktrees were removed | EXECUTED | `git worktree add` + `node scripts/check-context.mjs` | the four intended failures |
| 12 | Every PH-1..PH-9 journey in Chromium on the phase candidate, with case references read from the product (BL-023) | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-9` | exit 0, 54 observations, 29 screenshots (3.9 MB) kept as the phase set (DEC-0034 c) |
| 13 | api unit and e2e suites on PostgreSQL 16 with a real pool, on the final code | EXECUTED | `docker compose -f docker/compose.test.yml up -d --wait`; `SUPPORT_DATABASE_URL=postgres://postgres:orbit@localhost:55433/orbit_test npm run test:pg -w api`; `down -v` | unit 87/87, e2e 37/37; container removed |
| 14 | Static layers and production builds | EXECUTED | `npm run typecheck`, `npm run lint`, `npm run build` | exit 0 |
| 15 | Full gate on the candidate | EXECUTED | `bash scripts/gate-commit.sh` | at commit time |
| 16 | CI on the pushed commit, including the full-history checkout the checker now needs | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | recorded with the audit |

The smoke and the PostgreSQL run of claims 12–13 ran after the final change of claim 7 (the API was rebuilt; the web had not changed since its build).

## Course corrections, recorded
- Claim 7 changed the design before approval; DEC-0038 (b), the deployment and release runbooks (`SUPPORT_TRUST_PROXY` with the TLS proxy of any deployment beyond loopback) and BL-026 say so.
- The first negative run of claim 11 exposed that the checker never resolved an annotated ledger record cell (it reported "audit due" for the wrong reason); the record is now read as the cell's first `.md` path.
- An inline shell edit of that fix briefly lost its backslashes and made the real-tree check report every cycle as due; the next check-context run caught it and the line was rewritten from a file before any commit.

## Not verified
- `Retry-After` on the stream cap's 429 (it has no hint, so the filter's 5 s default applies): reasoned from the filter; supertest cannot hold eight open streams (as in PH-8.1).
- The cleanup job inside a running server: unit tests of `removeUnlinked` and of the job's `tick()` only.
- A real TLS proxy: claim 9 used a scratch Node proxy that appends `X-Forwarded-For` the way such proxies do.

## Correction and completion (Cycle Audit 3, 2026-09-14)
- Claim 16: CI run 34858502090 succeeded on both jobs, including the full-history checkout.
- Gate: shared 23, api 87, web 89, e2e 37.
- "Not verified: `Retry-After` on the stream cap": two Cycle Audit 3 reviewers observed it live (the ninth stream → 429 with `Retry-After: 5`).
