# PH-4.3 — Unavailable and not-found flows, masking review, phase closure
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-4.md`
Feature context: `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`

## Objective, prerequisites and scope
Demonstrate in a real browser what PH-4.1 and PH-4.2 promised for the unhappy paths: a record the boundary cannot find opens the case as an investigation with the reason on the card (scenario f, §14 item 7); an Orbit outage leaves every conversation, card and snapshot usable while the context says so and offers a retry (scenario b); subjects the boundary does not serve yet are listed as unavailable, never as empty or zero (RULE-SUP-07). Review masking on every surface and close PH-4 with the phase approval record. Prerequisites: PH-4.1, PH-4.2. Out of scope: any new subject through the boundary.

## Affected boundaries and implementation approach
- Staff Orbit section: an "Ainda não integrado" list (balances and movements, bonuses and promotions, P2P events, referrals and affiliates, product errors) with the `not_integrated` reason label.
- Browser smoke: (f) a case created through the API with a record reference the simulated Orbit does not know, opened by the customer and by staff; (b) the API restarted with `SUPPORT_SIMULATED_ORBIT=unavailable` on the same data — staff context unavailable with retry, host records list unavailable, case and snapshot still readable. The smoke gained `stopChild`/`waitForExit` helpers to restart one server.
- Masking review (by reading, recorded in the phase approval): the customer projection (DEC-0015) strips staff-only fields; the adapter masks contacts and destinations before anything crosses the boundary; cards and the context section render adapter output only; the `case_created` event stores kind, reference and whether a snapshot was captured — no record data.

## Required behavior, failures and acceptance evidence
- Not-found: customer card "Registro não encontrado no Orbit…", staff card the same plus "Estado atual indisponível"; the case is a normal open case.
- Outage: staff "Dados do Orbit indisponíveis: Orbit sem resposta." with "Tentar novamente"; host "Registros indisponíveis no momento."; the customer still opens the case and sees the snapshot card.
- Not-integrated subjects listed with their reason (web test).
Acceptance evidence: `../evidence/PH-4.3-verification.md`; phase evidence `../evidence/PH-4-phase-approval.md`.

## Work performed and important decisions
- `OrbitCustomerSection`: "Ainda não integrado" list (five subjects) with the `not_integrated` reason; copy under `staff.orbit.notIntegrated*`.
- `scripts/ui-smoke.mjs`: `stopChild` / `waitForExit`; scenario (f) through an API-created case with reference `WD-000000`; scenario (b) by restarting the API with `SUPPORT_SIMULATED_ORBIT=unavailable` on the same data directory; screenshots `20`–`22`.
- Masking review recorded in `../evidence/PH-4-phase-approval.md`; no code change was needed.

## Verification, limitations and context updates
Evidence: `../evidence/PH-4.3-verification.md`. Limitations: outage is simulated by an adapter switch, not by network faults or timeouts (the `timeout` reason exists in the contract but no adapter produces it yet); the retry in the section re-reads once.
Context updated: `PH-4.md`, `ROADMAP.md` (ledger), `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-ORBIT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../runbooks/VERIFICATION.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
