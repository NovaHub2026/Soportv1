# Staff workspace
Type: FEATURE CONTEXT
Feature ID: FEAT-STAFF
Lifecycle: PARTIAL
Freshness: CURRENT
Verified against: `4c06c5c` plus the PH-4.3 change (not-integrated subjects in the Orbit section)
Verified on: 2026-09-14
Scope: `apps/web/src/features/staff/`, `apps/web/src/lib/staff-api.ts`, `apps/web/src/lib/sse.ts`, `apps/web/src/app/staff/`, staff copy in `apps/web/src/i18n/pt-BR.ts`; API surface `/api/staff/cases*` including `/stream` (owned by FEAT-CASE)

## User outcome and applicable product rules
Support staff have a workspace with three areas — queues, conversation, customer/case context — comfortable for daily use, where ownership is clear and internal work never leaks to the customer (`PROJECT_CONTEXT.md` §5, OBJ-SUP-02, OBJ-SUP-03).
Rules: RULE-SUP-02 (managed queue / responsible person; transfers preserve follow-through), RULE-SUP-04 (internal notes never published), RULE-SUP-07 (verified vs pending vs unavailable information), RULE-SUP-09 (attributable actions).

## Current behavior and known gaps
Implemented (PH-1.4): route `/staff` with simulated-agent picker (**Simulação**); tabs "Não atribuídos" (oldest first), "Meus casos", "Todos ativos" with 10 s refresh and immediate refresh after actions; case view with header (reference, subject, staff status label, responsible), messages with customer / staff / system attribution and internal notes rendered with a dashed warning border and "Nota interna · visível só para a equipe"; "Assumir caso" only when unowned and open; "Responder ao cliente" composer (public reply); context column with customer id, identity source "Simulada", an explicit "Orbit data unavailable (PH-4)" note, case facts and the event timeline. Monotonic request counters prevent stale polls from hiding fresh actions (FND-0002). Live updates (PH-2.1): the workspace holds one `/api/staff/cases/stream` subscription; every case event refreshes the queue and, when it concerns the open case, the case view; polling drops to 60 s while connected. Measured delivery 129 ms customer → staff. Delivery states (PH-2.2): queue items show "N novas do cliente"; opening a case marks it read (`POST …/read`) and the badge clears live; the case header says whether the customer read the latest reply; the topbar shows the connection state. Attachments (PH-2.3): staff see customer files as thumbnails/chips in the conversation and can attach their own (same composer component, `/api/staff/cases/:id/attachments`).
Case actions (PH-3.1): "Aguardar cliente", "Aguardar equipe interna", "Retomar atendimento" and "Resolver caso" (inline form: reason + customer-facing explanation) in the case header; the header shows "Resolvido · <motivo>" and the history shows "Resolvido: <motivo>" / "Reaberto pelo cliente".
Internal collaboration (PH-3.2): the composer has two visibly different modes — "Responder ao cliente" and "Nota interna" (dashed amber field, "Salvar nota"); "Consultar equipe" opens a form (team + question); the context column lists consultations with a pending count and an inline "Responder consulta" form; history shows "Consulta enviada para <equipe>" / "Consulta respondida por <agente>".
Ownership and attributes (PH-3.3): "Transferir" (picker of simulated agents) and "Devolver à fila" in the action bar — a 403 shows "Só o responsável ou um supervisor pode transferir este caso."; priority and category are editable selects in the context column; history shows "Transferido para … por …", "Devolvido à fila por …", "Prioridade: … → …", "Assunto: … → …".
Closure (PH-3.4): "Encerrar caso" on resolved cases; continuations show "Continuação do caso SUP-…" with "Abrir caso anterior"; history shows "Encerrado pela equipe / após o prazo de acompanhamento" and "Continuação aberta: SUP-…".
Shared incidents (PH-3.5): the context column's "Incidente compartilhado" section links to an open incident or creates one, sends a note to all linked cases, marks the incident resolved (with the hint that cases need individual confirmation) and unlinks; queue items carry an "Incidente" tag.
Not-integrated subjects (PH-4.3): the Orbit section ends with "Ainda não integrado" — balances and movements, bonuses and promotions, P2P events, referrals and affiliates, product errors — each with the reason label, so staff treat them as unavailable information, never as zero (RULE-SUP-07).
Record cards (PH-4.2): a case opened from a record shows the card in the case header with the masked facts captured at opening; the Orbit section adds "Estado atual no Orbit" for that record (title · status, fetched time) or its unavailable reason — snapshot and current state are deliberately both visible (§6.2).
Orbit context (PH-4.1): the context column's "Cliente no Orbit" section (labeled Simulação) shows username, account status, environment (real/demo), verification with the next action, language · country, registration, masked e-mail and phone and when it was fetched — or "Dados do Orbit indisponíveis: <motivo>." with "Tentar novamente"; a one-line note says records are not integrated yet (PH-4.2).
Cycle Audit 1: the transfer picker and the identity picker read the shared `SIMULATED_STAFF_DIRECTORY` (the API validates transfer targets against the same list); "Resolver caso" with a pending consultation shows "Há consulta pendente com outra equipe…" (409 `consultations_open`); roles are labeled in pt-BR. Known limitation (FND-0023, BL-011): no view of waiting, resolved or closed cases — a resolved case is reachable only by id until PH-5.
Gaps (accepted target): filters, search by reference / user id / email / operation refs, saved replies, supervision views, schedule/config, metrics (PH-5); Orbit record cards and masked identity summary (PH-4); role-based permissions beyond agent/supervisor/admin labels (PH-7); the context column is hidden below 1100 px (desktop-first).

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
Component change → `npm test -w web`, `npm run lint -w web`; layout/copy change → `npm run build` + `scripts/ui-smoke.mjs`. Last scoped evidence: `docs/evidence/PH-4-phase-approval.md`, `docs/evidence/PH-4.2-verification.md`.
