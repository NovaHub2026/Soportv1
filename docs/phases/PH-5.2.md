# PH-5.2 — Filters and search
Type: SUBPHASE TECHNICAL PLAN
Status: PLANNED
Parent: `PH-5.md`
Feature context: `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Staff find a specific case in any view by typing what they have — a case reference (with or without `SUP-`), a customer id, words from the subject or a record reference — and narrow a queue by category, priority or responsible agent (context §5.2, scenario (d) of `PH-5.md`). Prerequisite: PH-5.1. Out of scope: search by username or authorized e-mail (those live in Orbit; the boundary exposes them masked — PH-7 decides), full-text search over messages.

## Affected boundaries and implementation approach
- Contracts: `staffListQuerySchema` += `q` (1–100 chars), `category`, `priority`, `agentId` (a directory id or `unassigned`).
- API: `listStaffCases` adds `WHERE` clauses — `q` matches the reference number exactly when it looks like one, otherwise `ILIKE %q%` on customer id, subject and record reference; filters are equalities; everything combines with the view and pagination.
- Web: a search box (debounced 300 ms) and two selects above the tabs; the current filters are kept per workspace session and sent with every list request; a "Limpar" control.

## Required behavior, failures and acceptance evidence
- `q=SUP-000003`, `q=3`, `q=cust-alice`, `q=WD-48213` and `q=saque` each find the expected case; an unknown term returns an empty list with the view's empty copy; `q` longer than 100 chars → 400; customers → 403.
- Filters by category/priority/agent narrow correctly and combine with `q`.
Acceptance evidence: `../evidence/PH-5.2-verification.md`.

## Work performed and important decisions
Filled at approval.

## Verification, limitations and context updates
Evidence: `../evidence/PH-5.2-verification.md`. Limitations: `ILIKE` over three columns without a trigram index (fine at this scale; revisit with PH-8 sizing).
Context updated at approval: `PH-5.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`.
