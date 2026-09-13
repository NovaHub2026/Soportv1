# ADR-0002 — Dedicated support project with an explicit Orbit integration boundary
Type: DECISION
Status: ACCEPTED
Recorded on: 2026-09-13
Decided on: 2026-09-13
Authority: Agent, delegated (`GOVERNANCE.md` §1.2, architecture) within `PROJECT_CONTEXT.md` §11: "Whether implementation lives in existing Orbit modules, a dedicated support project or another suitable arrangement is a technical decision".
Related: OBJ-SUP-02; RULE-SUP-01, RULE-SUP-05, RULE-SUP-07; PH-1, PH-4; BL-001

## Context and evidence
This repository contains no Orbit source code, and no Orbit API, schema or environment has been made available (inspected 2026-09-13). The Owner created a separate repository (`Soportv1`) for this work. The product requires integration with Orbit identity and records (context §6).

## Decision and alternatives
Build Orbit Support as a dedicated project in this repository. All access to Orbit identity and records goes through one explicit integration boundary (ports/adapters owned by FEAT-ORBIT). PH-1 uses a simulated identity provider behind that boundary, labeled as simulation in UI and docs; the real adapter is implemented when access exists (BL-001).
Alternatives: (a) implement inside Orbit's own modules — not possible without access to that code; revisit if the Owner grants it. (b) Postpone all work until access exists — rejected: the customer/staff experiences and the case lifecycle do not depend on the adapter.

## Product effect, costs and risks
Enables progress now and keeps Orbit's financial/identity authority outside support (RULE-SUP-05, context §6.3). Risk: the simulated model diverges from real Orbit data shapes — contained by keeping the boundary narrow and by context §11's rule that simulated records never demonstrate a connected capability.

## Verification, recovery and revisit conditions
Every demonstration states whether it uses simulation or real Orbit (context §14, item 10). Revisit when Orbit access is granted (BL-001) or if the Owner decides support must live inside Orbit's codebase.
