# PH-5.4 — Schedule and configuration, supervision overview, service metrics
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-5.md`
Feature context: `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Supervisors configure the operating schedule and the attention threshold, and the customer panel tells the truth about availability from that configuration (RULE-SUP-08, context §4.4, §5.4); supervisors see outstanding demand — by status, unassigned and their age, the oldest unanswered customer messages, load per agent — and act on the overdue list by reassigning; service outcomes are computed from the attributable history for a period and shown without invented targets (§14 success signals, §13.2, BL-002). Prerequisite: PH-5.3. Out of scope: notifications/reminders (PH-6), exports, forecasting, roles beyond the simulated labels (PH-7).

## Affected boundaries and implementation approach
- Contracts: `SupportSettings` (timezone, weekly schedule of open/close per weekday or closed, `attentionThresholdHours`, `followUpWindowDays`, attribution), `supportSettingsInputSchema`; `Availability` (open now, today's hours, next opening, schedule text, `configured: true` with a "working default" flag until Operations sets it); `SupervisionOverview` (counts by status, unassigned count + oldest, awaiting-reply count + oldest, per-agent load, overdue cases = awaiting a reply longer than the threshold); `ServiceMetrics` (period, created/resolved/closed/reopened counts, first human response and resolution durations as median/p90 with sample sizes, unanswered now, reopen rate, `targets: null`).
- Schema migration `0011`: `support_settings` (single row `default`, attributed updates).
- API: `GET /api/staff/settings` (staff), `PUT /api/staff/settings` (supervisor/admin; 403 `supervisor_required`); `GET /api/support/availability` (customer, computed from settings and the current time); `GET /api/staff/overview` and `GET /api/staff/metrics?days=7|30` (supervisor/admin). The closure job reads `followUpWindowDays` from settings (env stays as the fallback).
- Web: the customer home shows the configured schedule and whether support is open now, with the honest note that these are configured working hours; the staff topbar gains "Supervisão" for supervisors/admins — overview cards, overdue list with "Reatribuir", metrics (7/30 days) with the no-targets note, and the settings form.

## Required behavior, failures and acceptance evidence
- An agent gets 403 on `PUT settings`, `overview` and `metrics`; customers get 403 on every staff route and 200 on `availability`.
- Availability reflects the schedule: inside hours "aberto", outside "fechado" with the next opening; a fully closed day says so; the copy never promises response times.
- Overview counts match the queue views; overdue = awaiting reply longer than the configured threshold; reassignment from the overview records `case_assigned` like a transfer.
- Metrics are computed only from events/messages in the period and expose sample sizes; with no data they show "sem dados" rather than zero durations.
Acceptance evidence: `../evidence/PH-5.4-verification.md`; phase evidence `../evidence/PH-5-phase-approval.md`.

## Work performed and important decisions
- Shared `settings.ts`: `SupportSettings` / input schema, `DEFAULT_SUPPORT_SETTINGS` (weekdays 09:00–18:00 America/Sao_Paulo, 4 h attention, 7-day window), `computeAvailability`, `SupervisionOverview`, `ServiceMetrics`, `durationStats`.
- API: `support_settings` (migration `0011`), `SettingsService` (working defaults until saved; supervisor/admin updates), `SupervisionService` (overview, metrics from cases/messages/events), controllers `GET/PUT /api/staff/settings`, `GET /api/staff/overview`, `GET /api/staff/metrics`, `GET /api/support/availability`; the closure job reads the configured window.
- Web: availability line on the customer home; `SupervisionPanel` (demand, per-agent load, overdue with reassignment, metrics 7/30 d, settings form) behind "Supervisão" for supervisors/admins.
- DEC-0023: availability is derived from the configured schedule and labeled "working default" until Operations saves it; metrics carry `targets: null` and the UI states that no targets exist (BL-002); overdue = awaiting a human reply longer than the configured threshold; supervision gating uses the simulated role until PH-7.

## Verification, limitations and context updates
Evidence: `../evidence/PH-5.4-verification.md`. Limitations: schedule defaults are working defaults (BL-002); role gating uses the simulated role; metrics are computed on request (no aggregation tables).
Context updated: `PH-5.md`, `ROADMAP.md` (ledger), `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, feature contexts, `../runbooks/VERIFICATION.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
