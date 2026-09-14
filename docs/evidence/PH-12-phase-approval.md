# PH-12 — Phase approval and project closure record
Type: PHASE APPROVAL EVIDENCE
Phase: PH-12 — Project closure (`../phases/PH-12.md`)
Recorded on: 2026-09-14
Candidate: the PH-12.3 commit on `main` (child of `dfd7a41`), which carries the release record `RELEASE-2026-09-14c.md` and this record; the demo tag `v0.2.0-demo` is on `dfd7a41`.
Decision: APPROVED by the Agent (evidence-based, §6.3; not a human review). First-time approval, counted in cycle 4: the ledger goes to 2/3.
Why the phase existed: the Owner asked to finish everything pending and close the project so that only PH-11 remains, to be built directly with GPT (2026-09-14).

## Outcome against the plan
| Block | Delivered | Evidence | Commit / CI |
|---|---|---|---|
| PH-12.1 closable debt | BL-027 masking, BL-028 dead letters, BL-030 checker paths, BL-017 deploy CLI removed (DEC-0043; migration `0023`) | `PH-12.1-verification.md` | `33e8794`, run 34871371921 success |
| PH-12.2 closing audit | Five independent reviewers over PH-10 and PH-12.1; 17 findings (5 MATERIAL), all remediated or dispositioned (DEC-0044) | `../audits/CLOSING.md`, `CLOSING-verification.md` | `dfd7a41`, run 34875569705 success |
| PH-12.3 hand-over | Demo release `v0.2.0-demo`, the PH-11 brief completed (`../phases/PH-11.md`), this closure record, README pointer, final state | `RELEASE-2026-09-14c.md` | this commit; CI pending at recording |

## Acceptance scenarios (`PH-12.md`)
- §4.5 / §10.2 — a password or code typed into a recovery description never reaches staff in clear: PH-12.1 claims 1–4, closing audit FND-0108.
- RULE-SUP-03 / §4.4 — an e-mail that keeps failing stops being retried and is visible in the log as given up; the in-product notification stays: PH-12.1 claim 3, FND-0109.
- §7.5 — stale repository paths in operational files fail the checker: PH-12.1 claim 8, FND-0110.
- §12.1 / §15 — the next builder can start PH-11 from the repository alone: `PH-11.md` ("Where it plugs in", "Repository rules the build must follow", "How to start"), verified by the cold-start reviewer (every named file and symbol exists) and completed after FND-0104.

## What is closed and what remains
- Closed on the Agent's side: every backlog item the Agent could pay (`../BACKLOG.md`); every phase PH-1..PH-10 and PH-12 approved; every cycle audit through cycle 3 and the closing audit closed; the internal demo `v0.2.0-demo` carries everything delivered.
- Remains, by decision: PH-11 (the Owner's GPT build — its first approval brings cycle 4 to 3/3 and makes Cycle Audit 4 due, `PH-12.md` "After closure"); BL-001 (Orbit's adapters), retention of closed cases (legal advice), the e-mail provider, the AI provider account (BL-031); BL-005/BL-006 wait for their toolchain triggers; a production release needs the Owner (§1.1).
- Process owner after closure: the Owner or whoever the Owner delegates the repository to, through the same gate (`PH-12.md`).

## What this approval does not claim
- No production release; the demo runs on loopback with simulated identity, records and e-mail.
- The AI assistant does not exist; the brief is a plan, not a verified capability.
- Masking is heuristic; business days ignore holidays; the customer's zone is the browser's until Orbit's session carries one.
