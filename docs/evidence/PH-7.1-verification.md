# PH-7.1 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-7.1 — "Não consigo acessar minha conta" (access recovery route)
Recorded on: 2026-09-14
Revision: base `9b4e193` plus the PH-7.1 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Shared: a contact must look like an e-mail or a phone, descriptions are bounded and NUL-free, the reference formats as `REC-000001` | EXECUTED | `npm test -w @orbit-support/shared` (`access.test.ts`) | 19 tests passed |
| 2 | Service: the receipt carries only reference, time, next step and the simulation label; a retried request (same contact + `clientRequestId`) answers the same reference; the fourth request of a contact within an hour → 429 with `retryAfterSeconds`, allowed again an hour later; staff outcomes are attributable and a second outcome → 409; the service depends on the database only (no case, customer or Orbit service) | EXECUTED | `npm test -w api` (`access-recovery.service.spec.ts`, 3 tests) | 62 tests passed |
| 3 | HTTP: `POST /api/public/access-recovery` works with no identity and ignores one; a known customer's e-mail and an unknown one get the same shape (no account signal); invalid contact and NUL → 400; the abuse limit → 429; `GET /api/staff/access-recovery` → 401 without identity, 403 for customers; the handled request carries `handledById/Name`; a second outcome → 409; an unknown status filter → 400; migration `0016` applies on a fresh database | EXECUTED | `npm run test:e2e -w api` (PH-7.1 test) | 31 tests passed |
| 4 | Web: the form posts without any `x-simulated-*` header, keeps one `clientRequestId`, shows the reference and the next step, explains a 429 in minutes and keeps the form; the host link opens it without a session; the staff page lists requests and records an outcome with a note | EXECUTED | `npm test -w web` (`AccessRecoveryForm.test.tsx` ×2, `OrbitShell.test.tsx` PH-7.1, `StaffWorkspace.test.tsx` PH-7.1) | 69 tests passed |
| 5 | Integrated behavior in Chromium: the route from the host, the receipt, the staff page and the attributed outcome | OBSERVED | `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-7.1` after `npm run build` | see "Smoke" |
| 6 | Full gate on the candidate | EXECUTED | `npm run gate` | see "Final gate run" |
| 7 | CI executes the gate and the builds on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

Not verified: the per-instance burst limit (30 per 10 minutes) over HTTP (unit-tested by structure only through the per-contact limit; the window logic is read); a real hand-off to Orbit (there is none — the outcome is a labeled record, DEC-0028).

## Smoke
51 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-7.1/01`–`27`. New observations `access-recovery` (the host link, the form's "never a password or code" note, the receipt `REC-000001` with the next step, labeled simulation — `26-access-recovery-receipt.png`) and `access-recovery-staff` (the "Recuperação de acesso" page with the unverified contact, "Encaminhar ao processo de verificação" with a note, outcome attributed to Ana with its time — `27-staff-access-recovery.png`). Harness lesson: the first run picked the staff agent picker instead of the status filter (`getByRole('combobox').first()`); the step now uses the filter's label. Every earlier observation passed unchanged.

## Final gate run
`npm run build` (shared, nest, next) exit 0 before the smoke; `npm run verify` exit 0 at commit time through `scripts/gate-commit.sh` (check-context OK; lint/typecheck exit 0; Vitest shared 19/19, api 62/62, web 69/69, api e2e 31/31).

## CI
Pending push. Previous commit `9b4e193` (audit closure, docs only): see `gh run list` at the next record.
