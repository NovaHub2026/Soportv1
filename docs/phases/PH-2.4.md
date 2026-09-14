# PH-2.4 — Reliability evidence and phase closure
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-2.md`
Feature context: `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Close PH-2 with evidence that the reliability promises hold under the conditions that break naive chats: concurrent retries, dropped and reconnected streams, duplicate pushes; then demonstrate the integrated journey once more on the phase candidate and approve the phase. Prerequisites: PH-2.1–2.3. No new product scope.

## Affected boundaries and implementation approach
- Concurrency test for idempotent sends (customer and staff): three parallel sends with one `clientMessageId` → one stored message, all callers get the same id.
- Fix driven by that test (FND-0005): `CasesService.onceByClientMessageId` — a unique-index violation from a racing retry returns the winner's message instead of failing the request.
- Web tests: resync (`GET`) on every `connected`; a message pushed twice renders once.
- Browser smoke on the phase candidate (`docs/evidence/screenshots/ph-2/`).

## Required behavior, failures and acceptance evidence
See `../evidence/PH-2-phase-approval.md` for the mapping of PH-2 scenarios (1)–(5) to evidence.

## Work performed and important decisions
FND-0005 (MATERIAL): concurrent retries of the same send could surface a 500 (duplicate key) to the loser — a customer who double-tapped "Enviar" during a flaky connection would see an error even though the message was stored once. Fixed and covered. No decision changes.

## Verification, limitations and context updates
Evidence: `../evidence/PH-2.4-verification.md`, `../evidence/PH-2-phase-approval.md`. Limitations: reliability exercised in-process and with browser network emulation, not on real networks; single API instance.
Context updated: `PH-2.md`, `ROADMAP.md` (ledger 2/3), `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, feature contexts (freshness), `../evidence/PH-2-phase-approval.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
