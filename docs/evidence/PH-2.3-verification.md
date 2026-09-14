# PH-2.3 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-2.3 — Attachments
Recorded on: 2026-09-13 (runs 2026-09-14 01:21–01:32 UTC)
Revision: base `c628d8b` plus the PH-2.3 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: WSL2, Node v24.19.0, npm 11.17.0; Playwright 1.63 / Chromium 1243 with the BL-007 workaround; uploads written to a scratch `SUPPORT_UPLOADS_DIR`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Magic-byte sniffing accepts the four allowed formats and rejects executables, SVG, GIF and empty input | EXECUTED (incl. negatives) | `npm test -w api` (`sniff.spec.ts`) | 4 files, 26 tests passed |
| 2 | HTTP: upload accepted with type decided by bytes (`comprovante.jpg` containing PNG → `image/png`), linked on send, cannot be linked twice, served inline with `nosniff`; staff can read; another customer gets 404; staff upload not downloadable by the customer until on a public message; customer cannot link a staff upload | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (`attachments.e2e-spec.ts`) | passed. e2e total: 3 files, 13 tests |
| 3 | HTTP refusals: executable disguised as PNG → 415; > 10 MB → 413 (multer limit); missing file → 400; 4 ids → 400; other customer's case → 404 | EXECUTED (negative) | same e2e file | passed |
| 4 | Web: composer uploads and reports ready ids, removal, client-side refusals (size/type) and server refusals shown honestly, per-message maximum; list renders image thumbnails from fetched blobs and PDF chips with "Abrir"; unavailable state instead of a broken image | EXECUTED | `npm test -w web` (`Attachments.test.tsx`, 5 tests) | 7 files, 33 tests passed; lint and typecheck exit 0 |
| 5 | Integrated flow in Chromium | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-2.3` | 20 observations, exit 0: a real 1×1 PNG is attached and appears as a thumbnail in the customer panel and, live, in the staff case view (`12-staff-attachment.png`); a file named `foto.png` with executable bytes is refused and shown as "Tipo não permitido"; all earlier PH-1/PH-2 observations still pass; uploads landed in the scratch directory |
| 6 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 7 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: virus/malware scanning (out of scope; status `checking` reserved); behavior with real 10 MB images in the browser (e2e covers the server limit); object storage (PH-8).

Limitations / reuse boundary: valid for this tree. Changes under `apps/api/src/attachments/**`, the attachment endpoints or the web attachment components require claims 1–5 again.

## Final gate run
`npm run verify`, 2026-09-14 01:31 UTC, on the completed PH-2.3 tree: `check-context: 26 documents, 355 links (2 gitignored skipped), 8 phases, 9 subphases, active: PH-2 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 26/26, web 33/33; overall exit 0. `npm run build` exit 0 on the same tree (before the smoke).

## CI
Pending push.
