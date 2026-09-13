# ADR-0001 — Adopt GOVERNANCE.md Edition 3.1 for Orbit Support
Type: DECISION
Status: ACCEPTED
Recorded on: 2026-09-13
Decided on: 2026-09-13
Authority: Owner — supplied `GOVERNANCE.md` (Edition 3.1) and `PROJECT_CONTEXT.md` (v1.0) on 2026-09-13 with the instructions "Vamos a comenzar el proyecto, aquí te envío el documento inicial de governança" and "Aqui esta el contexto de proyecto".
Related: `GOVERNANCE.md` §15.1, §15.3, §17.4; `PROJECT_CONTEXT.md` §15

## Context and evidence
Repository `NovaHub2026/Soportv1` was empty when inspected on 2026-09-13 (no commits locally or on `origin`). Governance SHA-256 as adopted: `dac3619101076249bec51b4406de0edf0e900df299788b6f2d2005ab888e8b31` (841 lines). Both Owner documents were copied verbatim.

## Decision and alternatives
Adopt the governance as-is under the new-project procedure (§15.1), with project bindings recorded in `CLAUDE.md`. Alternative considered: writing project bindings inside `GOVERNANCE.md` — rejected because the governance must stay reusable across projects (§0.3). `EJECUTA` is bound to "execute the current task" (new adoption, §12.1).

## Product effect, costs and risks
No product effect. Cost: maintaining state, handoff, index and roadmap alongside code. Risk: documentation drift — mitigated by the state/link checker planned in PH-1.1 (BL-003).

## Verification, recovery and revisit conditions
Adoption exercises (§17.3) are verified progressively; the cold-start scenario is exercised at the first Cycle Audit. Revisit when the Owner supplies a new governance edition.
