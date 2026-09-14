# PH-7 — Phase approval evidence
Type: VERIFICATION EVIDENCE
Work item: PH-7 — Access recovery and privacy hardening (phase-level acceptance, `GOVERNANCE.md` §6.3)
Recorded on: 2026-09-14
Revision: the PH-7.2 commit plus the PH-7.3 working tree (the PH-7.3 commit on `main` is the phase candidate).
Environment: as in `PH-4.1-verification.md`.

## Phase scenarios (from `docs/phases/PH-7.md`) and evidence
| # | Scenario | Evidence | Category |
|---|---|---|---|
| a | A visitor with no session uses "Não consigo acessar minha conta", sends a contact and a description, receives "REC-000001" with the next step; the same contact cannot flood the route | Service test (idempotent retry, 3 per hour → 429), e2e (no identity, same shape for known/unknown contact, 429), web tests (no simulated header, 429 copy); smoke `access-recovery` (PH-7.1) | EXECUTED + OBSERVED |
| b | Staff see the request in "Recuperação de acesso", mark it forwarded (labeled simulation) and the outcome is attributable | Service + e2e (`handledById/Name`, second outcome → 409), web test; smoke `access-recovery-staff` (PH-7.1) | EXECUTED + OBSERVED |
| c | An agent resolving a colleague's case → 403 and the workspace explains it; a supervisor may; an unknown staff id → 401 | Shared table test, service test, identity tests, e2e (403/200/401, header role cannot promote), web test; smoke `role-model` (PH-7.2) | EXECUTED + OBSERVED |
| d | After "Sair" the next person sees nothing of the previous customer even after reload; the idle timeout signs out too | Web tests (storage cleared, neutral picker, idle with fake timers); smoke `sign-out`, `staff-sign-out` (PH-7.3) | EXECUTED + OBSERVED (idle: EXECUTED only) |
| e | An incident note broadcast to linked cases is absent from every customer surface under the role model | e2e PH-7.3 (detail, list, notifications, outbox; staff view keeps it); Cycle Audit 1 stream negatives unchanged | EXECUTED |

## Phase-level checks
- Every subphase approved with its own evidence: `PH-7.1-verification.md`, `PH-7.2-verification.md`, `PH-7.3-verification.md`.
- `npm run build` and the browser smoke on the phase candidate: see `PH-7.3-verification.md`.
- Simulation labeled on every new surface: the recovery form and receipt, the staff recovery page, both sign-out pickers (DEC-0003).
- Rules: RULE-SUP-01 (recovery reveals nothing; sign-out leaves nothing; unknown ids are nobody), RULE-SUP-02 (owner or supervisor for state changes), RULE-SUP-04 (privacy re-check), §4.5 (never a password or code), §10.2 (shared device).

## Limitations recorded
- Orbit's verification process and real sessions do not exist (BL-001/BL-002): the hand-off and the sessions are labeled simulations; sign-out clears the simulated identity and the browser buffers, not an Orbit session.
- Roles come from the simulated directory; revocation and stronger staff protection follow Orbit's policies (§10.2, PH-8 readiness).
- Contacts in recovery requests are shown to staff in full (they must reach the person); role-based masking of that contact is not implemented.

Implemented and locally verified: yes. Integrated: `main` (PH-7.3 commit). CI verified: recorded in `PH-7.3-verification.md` when known. Released: no.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review). Ledger: cycle 3 → 1/3.
