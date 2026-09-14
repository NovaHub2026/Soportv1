# PH-9.2 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-9.2 — Staff workspace debt (BL-014, BL-013 web, BL-024 carried items)
Recorded on: 2026-09-14
Revision: base `41adb23` plus the PH-9.2 working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: Windows 11 native, Git Bash, Node v24.19.0, npm 11.17.0, Playwright Chromium (headless). Sequential runs; in-memory PGlite for the suites, scratch PGlite directories for the browser runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | Staff composer: a failed note keeps its text; the retry sends the same key; the next note a new key. The existing note/consultation test now sends the key | EXECUTED | `npm test -w web` (`WorkspaceDebt.test.tsx`, `StaffWorkspace.test.tsx`) | 86 tests passed |
| 2 | System messages with a kind are worded by the dictionary on both surfaces (the stored body not shown); one without a kind shows its body | EXECUTED | `npm test -w web` (`WorkspaceDebt.test.tsx`, `ConversationDebt.test.tsx`) | passed (within claim 1) |
| 3 | A hidden browser tab marks nothing read; the next read while visible does. The workspace picker switches the identity headers and the supervision entry follows the role (BL-014's missing tests) | EXECUTED | `npm test -w web` | passed (within claim 1) |
| 4 | Queue tabs: one tab stop; ArrowLeft/ArrowRight (with wrap-around), Home and End change the view and move focus; the list is the tab panel labelled by the selected tab | EXECUTED | `npm test -w web` | passed (within claim 1) |
| 5 | Settings: an emptied threshold stays empty, is refused by its label and nothing is sent; "12" is sent as 12 and stays "12" | EXECUTED | `npm test -w web` | passed (within claim 1) |
| 6 | Customer: a failed message lists "Anexos: comprovante.png"; the retry sends the same body, key and attachment ids; the row disappears on success. `AttachmentComposer` reports ids and uploads | EXECUTED | `npm test -w web` (`ConversationDebt.test.tsx`, `Attachments.test.tsx`) | passed (within claim 1) |
| 7 | API: the outside-hours notice stores `systemKind: outside_hours` and `systemData: {}` when no day is open; a follow-up's back-reference stores `follow_up_of` with the parent reference; streams and HTTP carry both fields (strict contract test of PH-9.1 passes with the new fields) | EXECUTED | `npm test -w api`, `npm run test:e2e -w api` | 81 and 35 tests passed |
| 8 | Migration `0019` adds only `case_messages.system_kind` (text) and `system_data` (jsonb); schema and migrations agree | EXECUTED | `npm run db:generate -w api` | one file, two `ADD COLUMN` |
| 9 | Every PH-1..PH-8 journey still works through the split staff view (take, reply, notes, consultations, transfer, resolve, close, follow-up, incidents, supervision, recovery, outside hours, Orbit outage) | OBSERVED | `npm run build`, then `SUPPORT_DB_DIR=<scratch> SUPPORT_UPLOADS_DIR=<scratch> node scripts/ui-smoke.mjs <scratch>` | exit 0, 54 observations (screenshots kept in scratch — DEC-0034 c) |
| 10 | The new screens in Chromium against the built apps, including an API outage | OBSERVED | scratch probe (not committed, §11) | see "Probe"; exit 0, 9 observations, screenshots `screenshots/ph-9.2/01`–`07` |
| 11 | Static layers | EXECUTED | `npm run typecheck`, `npm run lint` (both apps) | exit 0 |
| 12 | Full gate on the candidate | EXECUTED | `bash scripts/gate-commit.sh` | see "Final gate run" |
| 13 | CI on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | recorded in the next state update |

## Probe
Built apps (API on 3001 with a scratch database, web on 3152). Schedule: one weekday open (Tuesday 09:00–18:00), today closed.
- The API stored the outside-hours notice with `systemKind "outside_hours"`, `systemData {"open":"09:00","weekday":"tue"}` and the body "… Próximo atendimento: terça-feira às 09:00."; the staff and customer conversations show "… Próximo atendimento: terça às 09:00." — the dictionary's wording, not the stored body (`02`).
- Queue: tab indexes `[0,-1,-1,-1,-1,-1,-1]`; ArrowRight selected and focused "Meus casos" with the panel labelled by `queue-tab-mine`; End → "Encerrados"; Home → "Não atribuídos" (`01`).
- API stopped: the customer's message with an uploaded PNG stayed as "Não enviada" with "Anexos: comprovante.png" and "Reenviar" (`03`); the staff note failed with an alert and kept its text (`04`).
- API restarted on the same database: the message was delivered once with its attachment and the note saved once (read back from the API) (`05` customer, `06` staff).
- Supervision as Carla: an emptied threshold stayed empty and "Salvar configuração" answered "Configuração inválida (Horas sem resposta para considerar atraso). Nada foi salvo." (`07`); "12" was saved as 12 and the field kept "12".
Observed in passing: in `03` the customer panel still said "Ao vivo" although the API had been stopped a few seconds earlier — the stream had not noticed the outage yet (the message itself was correctly "Não enviada"); tracked for the phase closure (PH-9.4) and the cycle audit.
Limitation: the note's first attempt never reached the API (it was down), so the browser run shows the retry path; the stored-but-unanswered case is covered by the API tests of PH-9.1.

## Gate refusal and fix
The first `scripts/gate-commit.sh` run refused the commit: three Cycle Audit 1 regression tests of `CaseConversation.test.tsx` failed (FND-0011 "nothing is retried": 2 sends instead of 1; FND-0012: a stale "Não enviada" row and 4 sends instead of 3). The same file passed alone 3 times, 6 times concurrently and the full web suite 3 times, so the failure was timing-dependent. Cause (INSPECTED): after a 404 the conversation cleared its pending list through state, but `retryFailed` reads a ref mirror that an effect updated only after the next render; an `online` event in that window re-sent the message, `send` put it back in the pending list, and `sessionStorage` (not cleared between tests of that file) carried it into the next tests. Fix: the 404 branch empties the mirror synchronously, `send` and `retryFailed` do nothing once the case is unavailable, the FND-0011 test also asserts that no pending entry remains in `sessionStorage`, and the file clears `sessionStorage` after each test. The product exposure was a retry toward a case the customer can no longer reach (refused by the API with 404, so no data crossed; RULE-SUP-01 held). The smoke and the probe (claims 9–10) ran before this guard; it changes only the path of a case that became unreachable, which they do not exercise, and the unit suites below ran after it.

## Final gate run
`npm run verify` through `scripts/gate-commit.sh` at commit time (check-context, build:shared, lint, typecheck, shared/api/web unit suites, api e2e).

## CI
Pending at recording time; recorded in `../../CURRENT_STATE.md` with the next update. `41adb23` (PH-9.1): run 34851816846 **success** (both jobs).

## Correction and completion (Cycle Audit 3, 2026-09-14)
- Screenshot `screenshots/ph-9.2/07` shows the settings form without the emptied field or the refusal message: it does not show what claim 10 says. The refusal is established by claim 5 (unit test) and by the probe's DOM check, not by the image (FND-0094).
- Gate: the accepted run passed shared 23, api 81, web 86, e2e 35 (after the refused run described above); CI run 34854751897 succeeded on both jobs.
