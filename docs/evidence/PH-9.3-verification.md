# PH-9.3 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-9.3 — Customer panel debt (BL-010, BL-015)
Recorded on: 2026-09-14
Revision: base `9ce5874` plus the PH-9.3 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: Windows 11 native, Git Bash, Node v24.19.0, npm 11.17.0, Playwright Chromium (headless). Sequential runs; in-memory PGlite for the suites, scratch PGlite directories for the browser runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Staged upload: staff → 403, a disguised executable → 415, a PNG → 201 with `caseId: null`; another customer's creation with that id → 400 and no case for them; the owner's creation → 201 with the file on the first message (`caseId` and `messageId` set), downloadable from the case and visible to staff; a retried creation (same key) returns the same case; a second case with the same id → 400 | EXECUTED | `npm run test:e2e -w api` (`attachments.e2e-spec.ts` PH-9.3) | 36 tests passed |
| 2 | Every earlier contract unchanged, including the strict response schemas (PH-9.1) with `CaseAttachment.caseId` now nullable; migration `0020` only drops `NOT NULL` on `case_attachments.case_id` | EXECUTED | `npm test -w api`, `npm run test:e2e -w api`, `npm run db:generate -w api` | 81 and 36 passed; one `ALTER COLUMN … DROP NOT NULL` |
| 3 | New-request form: the file goes to `/api/support/attachments` with the customer's identity and the creation carries `attachmentIds` | EXECUTED | `npm test -w web` (`NewRequestForm.test.tsx`) | 88 tests passed |
| 4 | Desktop: "×" sets the hidden state, the topbar reads "Suporte" with `aria-expanded=false` and holds focus, clicking it shows the panel, the topbar control closes it too; the FND-0034 stream test still holds with the desktop layout | EXECUTED | `npm test -w web` (`OrbitShell.test.tsx`) | passed (within claim 3) |
| 5 | A send right after an upload carries its id: the first run of claim 3 sent the creation without `attachmentIds` because the composer reported ready uploads in a passive effect that could run after the chip showed "ready"; the report now runs in a layout effect (same commit as the chip), and the test passes | EXECUTED | `npm test -w web` | failed once, then 88 passed |
| 6 | The customer attaches a PNG to the very first message: the chip is ready before any case exists; the new case SUP-000001 shows the thumbnail on message 1, and staff read the file on message 1 with the case id set by the creation | OBSERVED | scratch probe (not committed, §11) on the built apps | `screenshots/ph-9.3/01`, `02` |
| 7 | On a 1280 px screen "×" hid the 420 px side panel and the trading area grew from 860 to 1280 px; the topbar read "Suporte" (`aria-expanded=false`) and held focus; "Suporte" brought the panel back with SUP-000001 still open; after closing it with the topbar control, "Preciso de ajuda" on a record opened it again on the request form about that record | OBSERVED | scratch probe | `screenshots/ph-9.3/03`, `04` |
| 8 | Every PH-1..PH-9.2 journey still works (desktop starts with the panel shown; mobile unchanged) | OBSERVED | `npm run build`, then `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs <scratch>` | exit 0, 54 observations (screenshots kept in scratch — DEC-0034 c) |
| 9 | Static layers | EXECUTED | `npm run typecheck`, `npm run lint` (both apps) | exit 0 |
| 10 | Full gate on the candidate | EXECUTED | `bash scripts/gate-commit.sh` | at commit time |
| 11 | CI on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | recorded in the next state update |

The browser runs (claims 6–8) used a build that includes the layout-effect change of claim 5.

## Limitations
- A staged file that never opens a case stays until the orphan cleanup (BL-009, PH-9.4).
- jsdom has no layout: the hiding itself is observed in the browser (claim 7), the state and focus in the unit tests.
- The follow-up form of a closed case stays text-only (DEC-0037 a).

## CI
Pending at recording time. `9ce5874` (PH-9.2): run 34854751897 **success** (both jobs).
