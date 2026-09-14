# Staff workspace
Type: FEATURE CONTEXT
Feature ID: FEAT-STAFF
Lifecycle: PARTIAL
Freshness: CURRENT
Verified against: `88ee96c` plus the PH-2.4 change (PH-2 closure; no behavior change in this scope)
Verified on: 2026-09-13
Scope: `apps/web/src/features/staff/`, `apps/web/src/lib/staff-api.ts`, `apps/web/src/lib/sse.ts`, `apps/web/src/app/staff/`, staff copy in `apps/web/src/i18n/pt-BR.ts`; API surface `/api/staff/cases*` including `/stream` (owned by FEAT-CASE)

## User outcome and applicable product rules
Support staff have a workspace with three areas — queues, conversation, customer/case context — comfortable for daily use, where ownership is clear and internal work never leaks to the customer (`PROJECT_CONTEXT.md` §5, OBJ-SUP-02, OBJ-SUP-03).
Rules: RULE-SUP-02 (managed queue / responsible person; transfers preserve follow-through), RULE-SUP-04 (internal notes never published), RULE-SUP-07 (verified vs pending vs unavailable information), RULE-SUP-09 (attributable actions).

## Current behavior and known gaps
Implemented (PH-1.4): route `/staff` with simulated-agent picker (**Simulação**); tabs "Não atribuídos" (oldest first), "Meus casos", "Todos ativos" with 10 s refresh and immediate refresh after actions; case view with header (reference, subject, staff status label, responsible), messages with customer / staff / system attribution and internal notes rendered with a dashed warning border and "Nota interna · visível só para a equipe"; "Assumir caso" only when unowned and open; "Responder ao cliente" composer (public reply); context column with customer id, identity source "Simulada", an explicit "Orbit data unavailable (PH-4)" note, case facts and the event timeline. Monotonic request counters prevent stale polls from hiding fresh actions (FND-0002). Live updates (PH-2.1): the workspace holds one `/api/staff/cases/stream` subscription; every case event refreshes the queue and, when it concerns the open case, the case view; polling drops to 60 s while connected. Measured delivery 129 ms customer → staff. Delivery states (PH-2.2): queue items show "N novas do cliente"; opening a case marks it read (`POST …/read`) and the badge clears live; the case header says whether the customer read the latest reply; the topbar shows the connection state. Attachments (PH-2.3): staff see customer files as thumbnails/chips in the conversation and can attach their own (same composer component, `/api/staff/cases/:id/attachments`).
Gaps (accepted target): internal-note composer, "waiting for customer / internal team" transitions, resolve with reason, transfer, consultation, priority/category edit (PH-3); filters, search by reference / user id / email / operation refs, saved replies, supervision views, schedule/config, metrics (PH-5); Orbit record cards and masked identity summary (PH-4); role-based permissions beyond agent/supervisor/admin labels (PH-7); the context column is hidden below 1100 px (desktop-first).

## Dependencies and consumers
Depends on: FEAT-CASE staff endpoints, FEAT-ORBIT identity headers (`x-simulated-staff-id`, `-name`, `-role`), shared `StatusBadge` from FEAT-CHAT (`apps/web/src/features/support/StatusBadge.tsx`).
Used by / affects: supervision and metrics (PH-5) will extend the queue; FEAT-NOTIFY may add unread markers here. Staff copy is under `staff` in the dictionary; staff status labels differ deliberately from customer labels.

## Where to work
- Layout and identity: `apps/web/src/features/staff/StaffWorkspace.tsx`; queue `StaffQueue.tsx`; case view + context `StaffCaseView.tsx`; styles `staff.module.css`.
- API client: `apps/web/src/lib/staff-api.ts`.
- Tests: `apps/web/src/features/staff/StaffWorkspace.test.tsx`. Browser evidence: `scripts/ui-smoke.mjs` (staff steps).

## Important failure and permission behavior
Take conflicts (someone else took it) surface as an error line, never silently. Send failures keep the draft. A refresh error never wipes a loaded case. Missing Orbit data is shown as unavailable, never as zero or success (RULE-SUP-07). Internal notes are only fetched through staff endpoints; the customer surface filters them server-side.

## Decisions and assumptions
DEC-0007 (pt-BR staff copy by default; responsible shown by id until profiles exist). Assumption: agents work on desktop-class screens; a narrow layout keeps queue + conversation only.

## Verification and change checklist
Component change → `npm test -w web`, `npm run lint -w web`; layout/copy change → `npm run build` + `scripts/ui-smoke.mjs`. Last scoped evidence: `docs/evidence/PH-1.4-verification.md`.
