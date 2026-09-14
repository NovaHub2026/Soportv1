# PH-9 — Phase approval
Type: PHASE APPROVAL EVIDENCE
Phase: PH-9 — Release-candidate debt (`../phases/PH-9.md`)
Recorded on: 2026-09-14
Candidate: the PH-9 approval commit on `main` (child of `3339aef`), which carries PH-9.4 and this record.
Decision: APPROVED by the Agent (evidence-based, §6.3; not a human review). First-time approval, counted in cycle 3: the ledger reaches 3/3 and Cycle Audit 3 is opened in the same commit (`../audits/CYCLE-3.md`).
Why the phase existed: the Owner asked to continue with the pending phases («continua con las siguientes fases pendientes», 2026-09-14); every capability of the initial scope was approved, and the Agent-owned debt the audits carried was the part of the way to production the Agent could move alone.

## Outcome against the plan
| Block | Delivered | Evidence | Commit / CI |
|---|---|---|---|
| PH-9.1 case domain | BL-022 (rule owners, reminders under the lock, job tests), BL-029 (open consultations count as waiting for a team), BL-013 API (note retry key), BL-018 (strict response contracts in e2e) | `PH-9.1-verification.md` | `41adb23`, run 34851816846 success |
| PH-9.2 staff workspace | BL-014 (`runAction`, split view, picker and hidden-tab tests), BL-013 web (per-mode keys, files on pending rows), BL-024 (real tabs, number fields, system messages worded by the dictionary — migration `0019`) | `PH-9.2-verification.md` | `9ce5874`, run 34854751897 success |
| PH-9.3 customer panel | BL-010 (files on the first message — staged uploads, migration `0020`), BL-015 (desktop close controls) | `PH-9.3-verification.md` | `3339aef`, run 34855948382 success |
| PH-9.4 operations and process | BL-026 (`Retry-After` on every 429; per-client recovery limit behind an appending proxy), BL-009 (cleanup of uploads never linked), BL-023 (smoke references read from the product), BL-030 (checker: command-span paths, cited commits and tags, out-of-band records) — partly | `PH-9.4-verification.md` | this commit; CI pending at recording |

## Acceptance scenarios (`PH-9.md`)
- RULE-SUP-03 — a retried internal note is stored once; a failed send keeps text and files: PH-9.1 claim 3, PH-9.2 claims 1, 6 and 10.
- RULE-SUP-02 / §5.4 — a case a team still owes an answer counts as waiting for a team whatever its status: PH-9.1 claim 5.
- DEC-0017 — reminders decided on the locked row inside `CasesService`: PH-9.1 claim 4.
- §10.1 — real queue tabs, number fields kept as typed, system messages worded through the dictionary: PH-9.2 claims 2, 4, 5 and 10.
- §4.3 — files on the very first message: PH-9.3 claims 1, 3 and 6; desktop close: PH-9.3 claims 4 and 7.
- §4.5 / FND-0070 — every 429 says when to retry; one client cannot keep the recovery route busy behind an appending proxy: PH-9.4 claims 1, 5, 8 and 9.

## Integrated journey on the phase candidate
- Full browser smoke on the final code: exit 0, 54 observations covering every PH-1..PH-9 journey, screenshots `screenshots/ph-9/` (phase set — DEC-0034 c).
- api unit and e2e suites on PostgreSQL 16: 87/87 and 37/37.
- Unit and e2e on PGlite at the gate; production builds exit 0.

## Findings during the phase, fixed before approval
- PH-9.2: the gate refused a commit on a timing race — the customer conversation could re-send a pending message toward a case that had just become unreachable; fixed and its test isolation corrected.
- PH-9.3: a test showed that a send right after an upload could miss the file's id; the composer now reports ready uploads in the same commit as the chip.
- PH-9.4: a probe through the built web disproved the first per-client limit design; no proxy is trusted unless a deployment configures one (DEC-0038 b).
- PH-9.4: the checker never resolved an annotated ledger record; fixed and demonstrated on disposable worktrees.

## Carried, limits and what this approval does not claim
- BL-030 carried part (non-Markdown sources, CI run ids). Owner-dependent: BL-001, BL-002, BL-027, BL-028. Toolchain: BL-005, BL-006, BL-017.
- Observed in passing and handed to the audit: the customer panel kept saying "Ao vivo" for a few seconds after the API stopped (PH-9.2 evidence).
- Identity, Orbit records and e-mail remain simulated (ADR-0002, DEC-0003); no production release is implied (§1.1).
