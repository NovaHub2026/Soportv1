# PH-1.4 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-1.4 — Minimal staff workspace
Recorded on: 2026-09-13 (runs 2026-09-14 00:38–00:45 UTC)
Revision: base `5053df4` plus the PH-1.4 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: WSL2, Node v24.19.0, npm 11.17.0; Playwright 1.63.0 / Chromium headless shell 1243 with the BL-007 library workaround. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Web lint and typecheck pass | EXECUTED | `npm run lint -w web`; `npm run typecheck -w web` | exit 0 on the first attempt |
| 2 | Component behavior | EXECUTED | `npm test -w web` — Vitest, jsdom, Testing Library | 5 files, 18 tests passed (5 new): queue requests the selected view with the simulated staff headers (`x-simulated-staff-id`, `-role`) and lists cases with staff status labels; tab change reports the view; empty-queue copy per view; case view shows customer message, internal note tagged "Nota interna", Orbit context marked unavailable and the "Caso aberto pelo cliente" event; take posts to `/take`, shows the responsible agent, hides the button and notifies the workspace; a public reply is posted and then displayed attributed to "Ana Ribeiro (você)" |
| 3 | Integrated PH-1 journey in Chromium, both UIs | OBSERVED | `npm run build`; `SUPPORT_DB_DIR=<scratch> node scripts/ui-smoke.mjs docs/evidence/screenshots/ph-1.4` | 12 observations, exit 0 (final run 2026-09-14 00:47 UTC, after FND-0002 below). Customer (1280×800): panel, new request, case `SUP-000001` "Recebido". Staff (1440×900, `/staff`): unassigned queue lists the case (`08-staff-queue.png`); take → responsible `staff-ana`, status "Em atendimento"; reply typed in "Resposta ao cliente" appears in the conversation, context column shows Orbit data as unavailable (`09-staff-case-reply.png`); case moves to "Meus casos", unassigned queue reads "Nenhum caso aguardando atribuição.". Customer panel then shows the reply attributed to "Ana Ribeiro" within 15 s and status "Em atendimento"; follow-up, reload continuity, other-customer privacy and mobile checks as in PH-1.3 |
| 4 | Servers started by the smoke are stopped and ports released | EXECUTED | `ss -ltnp` after the run | nothing listening on 3001/3150 |
| 4b | Finding **FND-0002** (MATERIAL, product): a poll that started before an action could overwrite the action's result, so a just-sent reply vanished for up to one refresh interval | OBSERVED → fixed → EXECUTED | Screenshot `09` of the first run showed the staff conversation without the reply that the smoke had just confirmed; root cause read in code (stale response applied after the fresher one). Fix: monotonic request counter in `StaffCaseView`, `StaffQueue` and the customer `CaseConversation`; actions re-read the case and supersede in-flight polls. Smoke now re-checks visibility 2.5 s after sending on both UIs | Second run: 12 observations, exit 0; `09-staff-case-reply.png` shows the reply, the history with "Atribuído a Ana Ribeiro" and status changes; 18 web tests pass with mocks that reflect server state after actions |
| 5 | Full gate passes on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 6 | CI executes the gate on the pushed commit | NOT VERIFIED | `.github/workflows/ci.yml` | see "CI" |

Not verified: take conflict between two agents at the UI (covered at the service level in PH-1.2, tested as an error message path only by inspection); keyboard-only operation of the queue tabs beyond `role="tab"` semantics; behavior of the context column below 1100 px (hidden by CSS, INSPECTED).

Limitations / reuse boundary: valid for this tree. Changes under `apps/web/src/features/staff/**`, `apps/web/src/lib/**` or the pt-BR dictionary require rerunning claim 2; layout changes require the browser smoke after `npm run build`.

## Final gate run
`npm run verify`, 2026-09-14 00:48 UTC, on the completed PH-1.4 tree: `check-context: 16 documents, 174 links (2 gitignored skipped), 8 phases, 5 subphases, active: PH-1 — OK`; build:shared, lint and typecheck exit 0; Vitest shared 7/7, api 15/15, web 18/18; overall exit 0.

## CI
Pending push.
