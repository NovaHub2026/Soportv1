# PH-5.3 — Verification evidence
Type: VERIFICATION EVIDENCE
Work item: PH-5.3 — Saved replies (record shared with PH-5.2, committed together)
Recorded on: 2026-09-14
Revision: base `3217c53` plus the PH-5.2 and PH-5.3 working tree, committed together as the next commit on `main` (this record travels with it — §3.4). This commit also restores a consistent tree after FND-0028 (see `PH-5.1-verification.md`).
Environment: as in `PH-4.1-verification.md`. Sequential runs.

## Claims
| # | Claim | Category | Method / command | Result |
|---|---|---|---|---|
| 1 | HTTP: customers → 403; empty title → 400; any staff creates (attributed); another agent cannot edit or remove (403); a supervisor edits (attributed, category cleared when omitted); the author removes (204); a removed reply → 404; migration `0010` applied on fresh databases | EXECUTED (incl. negatives) | `npm run test:e2e -w api` (1 new test; plus the PH-5.2 search test) | see "Final gate run" |
| 2 | Web: the composer picker inserts the saved text into the draft without sending; the management panel lists, creates, edits and removes (panel exercised by reading and in the smoke through the API-created reply) | EXECUTED | `npm test -w web` (1 new test; plus the PH-5.2 filter test) | see "Final gate run" |
| 3 | Integrated behavior in Chromium: a saved reply created by a supervisor is offered in Ana's composer and inserted into the draft, editable, nothing sent; search narrows the list and "Limpar" restores it | OBSERVED | `npm run build`; smoke → `docs/evidence/screenshots/ph-5.3` | see "Smoke" |
| 4 | Full gate on the candidate | EXECUTED | `npm run verify` | see "Final gate run" |
| 5 | CI executes the gate on the pushed commit | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | see "CI" |

## Smoke
43 observations, exit 0 (2026-09-14), screenshots `screenshots/ph-5.3/01`–`24`. New observations: `saved-reply` — a reply created by the supervisor through the API ("Saque em análise") was offered in Ana's composer; choosing it inserted the text into the draft, nothing was sent, the agent cleared it and continued; `search` — searching "WD-48213" under "Todos ativos" listed only SUP-000003 (the debounced list dropped SUP-000002), "nada-disso" showed "Nenhum caso ativo no momento." and "Limpar" restored the list. Two harness fixes on the way: the context-column "Prioridade" locator became exact (the new filter select also matched), and the search assertion waits for the debounce. Every earlier observation passed unchanged.

## Final gate run
**Corrected (FND-0028, second occurrence).** At commit time of `6d11ee8` the `verify` run failed at `check-context` (the pre-written `docs/phases/PH-5.4.md` linked evidence files that did not exist yet) and the chain stopped there; the commit was created anyway because a heredoc in the shell command ended the `&&` chain. The suites had run individually on the same tree (api unit 52/52, api e2e 26/26, web 56/56; lint/typecheck exit 0) and the smoke passed, but claim 4 is NOT VERIFIED for `6d11ee8`. The next commit (documentation only: pending links marked as such, this record completed) is the first with a full green `verify` on this code; from that commit on, every commit is produced by a gate-then-commit script that cannot commit after a failed gate.

## CI
Commit `6d11ee8`: expected **failure** (check-context) — see "Final gate run". The corrective commit's run is recorded below when known.
Corrective commit `c3fc6a8`: run 34815816291 — **success** (first green run on the PH-5.2/5.3 code).
