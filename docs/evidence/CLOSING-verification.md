# Closing audit — remediation evidence
Type: VERIFICATION EVIDENCE
Work item: PH-12.2 — closing audit remediation (`../audits/CLOSING.md`, FND-0101..FND-0117; DEC-0044)
Recorded on: 2026-09-14
Revision: base `33e8794` plus the remediation working tree, committed as the next commit on `main` (this record travels with it — §3.4).
Environment: Windows 11 native, Git Bash, Node v24.19.0, npm 11.17.0. Sequential runs; in-memory PGlite for the suites.

## Claims
| # | Claim | Finding | Category | Method / command | Result |
|---|---|---|---|---|---|
| 1 | An export of a customer whose case was taken, re-prioritized, consulted and linked to an incident holds exactly `case_created`, `status_changed`, `status_changed` as events and contains no internal note, consultation text, incident title, staff id or priority | FND-0101 | EXECUTED | `npm run test:e2e -w api` (PH-10.3 test) | 39 tests passed |
| 2 | The "Reclamação formal" note names the supervisor and contains neither "dias" nor "prazo" | FND-0102 | EXECUTED | `npm test -w web` (`NewRequestForm.test.tsx`) | passed (within claim 8) |
| 3 | An agent-owned case reclassified into a complaint is released with a `case_assigned` event (`released: true`, `reason: formal_complaint`) before the `category_changed` event; a supervisor owner is kept; an agent's incident-wide note skips the linked complaint (`delivered: 0, skippedComplaints: 1`) while a supervisor's reaches it; an agent cannot move a complaint's read marker | FND-0106, FND-0107 | EXECUTED | `npm test -w api` (`cases.service.spec.ts`, "closing audit FND-0106/0107") | 99 passed, 1 skipped (PostgreSQL-only) |
| 4 | `maskLikelySecrets`: "clave", "chave de acesso", a spaced code, an all-caps code, a plural "senhas", a twelve-word recovery phrase and an English seed phrase are masked; prose about a lost recovery phrase is untouched; every earlier case unchanged | FND-0108 | EXECUTED | `npm test -w @orbit-support/shared` (`access.test.ts`) | 27 tests passed |
| 5 | Dead letters: attempts 1..5 and parking still come out as before with the decision taken in the `UPDATE … RETURNING`; a parked row is never claimed | FND-0109 | EXECUTED | `npm test -w api` (dead-letter test) | passed (within claim 3) |
| 6 | Checker, positive: the tree passes with the exact-case rule | FND-0110 | EXECUTED | `npm run check:context` | OK (71 documents, 1168 links) |
| 7 | Checker, negative (§7.3): in a disposable worktree of `33e8794` with the new checker, a reference to `docs/Phases/ROADMAP.md` (wrong case, exists on Windows) fails with "referenced path not found"; the worktree was removed | FND-0110 | EXECUTED | `git worktree add` + `node scripts/check-context.mjs` | the intended failure |
| 8 | Web: under `TZ=Asia/Tokyo` the availability line reads "Hoje: 21:00–06:00." before a same-day opening, "Segunda: 21:00–06:00." when the window began the previous local day, only the next opening once the window has passed, and "Atendimento 24 horas até terça às 12:00." for an all-day window that began yesterday (literal strings); a finished complaint reads "Prazo era …" without attention styling while an open one reads "Prazo vencido há"; a complaint's transfer list offers only the admin and a `supervisor_required` refusal shows the rule; the export section shows the list failure with a retry, blames the input on a 400 only, says "O download foi iniciado" and offers "Baixar de novo" without a fourth export request; the recovery page notes a masked description | FND-0111, FND-0112, FND-0113, FND-0114, FND-0107 | EXECUTED | `npm test -w web` (`SupportHome.zone.test.tsx`, `StaffWorkspace.test.tsx`) | 113 tests passed |
| 9 | Documents: `ROADMAP.md` active chain, `CONTEXT_INDEX.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, BL-031, `OPERATIONS.md`, `VERIFICATION.md`, the five feature contexts, `PH-10.2.md`, the two evidence corrections, `PH-11.md`, `PH-12.md`, `CLAUDE.md`, root `AGENTS.md`, DEC-0044 and the DEC-0042/0043 amendments | FND-0103, FND-0104, FND-0105, FND-0114, FND-0115, FND-0116, FND-0117 | INSPECTED | `git diff --stat`, `npm run check:context` | as listed; checker OK |
| 10 | Static layers | — | EXECUTED | `npm run typecheck`, `npm run lint` (both apps) | exit 0, no warnings |
| 11 | Full gate on the candidate | — | EXECUTED | `bash scripts/gate-commit.sh` | the `Gate-Verified` trailer of the commit |
| 12 | CI on the pushed commit | — | NOT VERIFIED at recording time | `.github/workflows/ci.yml` | recorded in the PH-12.3 release record |

## Limitations
- No browser run for this remediation: the screens changed are covered by the web tests above; the release candidate of PH-12.3 runs the full smoke (`verify:full`).
- Masking remains heuristic (a secret written as an ordinary word passes; an eight-word sentence of unusual words could be masked as a phrase — leaning towards masking, DEC-0043 a).
- The dead-letter race of FND-0109 is unreachable under the single instance of DEC-0033; the fix was verified by the unit test and the SQL, not by a concurrent run.
