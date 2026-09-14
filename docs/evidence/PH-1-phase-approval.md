# PH-1 — Phase approval evidence
Type: VERIFICATION EVIDENCE
Work item: PH-1 — Foundation and end-to-end case skeleton (phase-level acceptance, `GOVERNANCE.md` §6.3)
Recorded on: 2026-09-13 (final runs 2026-09-14 00:50–00:55 UTC)
Revision: `b5d3890` plus the PH-1.5 working tree (the PH-1.5 commit on `main`); the phase candidate is that commit.
Environment: as in `PH-1.5-verification.md`.

## Phase acceptance criteria (from `docs/phases/PH-1.md`) and evidence
| Criterion | Evidence | Category |
|---|---|---|
| All required work complete | PH-1.1–PH-1.5 `APPROVED` with their own evidence records | INSPECTED |
| Gate passing on the candidate | `npm run build` exit 0 on this tree (shared, api, web); `npm run verify` — see `PH-1.5-verification.md` "Final gate run" | EXECUTED |
| End-to-end scenario demonstrated in both UIs (context §14 situation 2) | `scripts/ui-smoke.mjs` on this tree, 12 observations, exit 0: customer opens "Suporte", sends a request, gets `SUP-000001` "Recebido"; in `/staff` the case is in "Não atribuídos", Ana takes it, replies; the reply reaches the customer panel within 15 s; follow-up, reload continuity, other-customer privacy, mobile layout. Screenshots `screenshots/ph-1/01`–`09` | OBSERVED |
| Negative case for cross-customer access (RULE-SUP-01) | Service test "answers not-found when another customer asks for the case by id"; e2e "another customer cannot see it (404)"; smoke "privacy" observation at the UI | EXECUTED + OBSERVED |
| Opening the panel creates nothing; the first message creates the case | Smoke: empty history until the request is sent; service/e2e tests create only on POST | OBSERVED + EXECUTED |
| Persistence across reload and server restart | Smoke reload continuity; PH-1.2 persisted-restart observation | OBSERVED |
| Customer UI copy pt-BR, staff copy pt-BR, structure ready for `es` | Dictionary test covers every status/category; `getDictionary(locale)` | EXECUTED + INSPECTED |
| Simulation labeled honestly (context §14 item 10) | Health reports `identity: simulated`; both UIs show **Simulação**; `/api/identity/me` returns `source` | OBSERVED + EXECUTED |
| Affected context updated | Feature contexts FEAT-CASE/CHAT/STAFF/ORBIT; index, roadmap, state, handoff, runbook, decisions | INSPECTED |

## Delivery states (§6.3)
Implemented and locally verified: yes. Integrated: on `main` (single-branch trunk, no PRs). CI verified: the PH-1.5 commit's run is recorded in `PH-1.5-verification.md`. Released: no — nothing is deployed; production release requires Owner authorization (§1.1) and PH-8.

## Uses simulation
Every demonstration in this phase uses the simulated identity provider and no Orbit records (DEC-0003). None of it demonstrates a connected Orbit capability (context §11).

## Findings during the phase
FND-0001 (PH-1.1, checker depended on local artifacts) and FND-0002 (PH-1.4, refresh race hiding a sent message) — both fixed and re-verified in their subphases. No open findings at approval.

## Approval
PH-1 `APPROVED` on 2026-09-13 by the Agent (evidence-based, not a human review). First-time approval counted in the audit ledger: cycle 1, 1/3.
