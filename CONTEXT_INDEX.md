# CONTEXT INDEX
Type: CONTEXT INDEX — topic routing + document catalog in one file while small (`GOVERNANCE.md` §3.1)
Updated: 2026-09-14

## Topic routes
Start a task at its feature row: the `CONTEXT.md` carries the authoritative freshness metadata (scope, verified-against revision, `CURRENT` / `STALE` / `UNKNOWN`). Rows marked pending are reserved ids whose capability has not started.

| Feature ID | Name and aliases (en / pt-BR / es) | Context path | Rules | Source / test scope | Depends on / used by |
|---|---|---|---|---|---|
| FEAT-CASE | Case lifecycle — ticket, caso, chamado, status, fila, resolver, encerrar, encerramento, continuação, follow-up, consulta, consultation, nota interna, internal note, incidente, incident, transferir, transfer, idempotência, clientMessageId | `docs/features/FEAT-CASE/CONTEXT.md` | RULE-SUP-02, -03, -05, -06, -09 | `packages/shared/src/cases.ts`, `apps/api/src/cases/`, `apps/api/src/database/` | depends on FEAT-ORBIT actors, ADR-0003; used by FEAT-CHAT, FEAT-STAFF |
| FEAT-CHAT | Customer support chat — suporte, chat, conversa, painel, conversación | `docs/features/FEAT-CHAT/CONTEXT.md` | RULE-SUP-01, -03, -06, -08 | `apps/web/src/features/support/`, `apps/web/src/features/shell/`, `apps/web/src/lib/api.ts` | depends on FEAT-CASE, FEAT-ORBIT |
| FEAT-STAFF | Staff workspace — área de suporte, fila, atendimento, atendente, bandeja, consultar equipe, nota interna, incidente compartilhado, transferir, devolver à fila, encerrar caso | `docs/features/FEAT-STAFF/CONTEXT.md` | RULE-SUP-02, -04, -07, -09 | `apps/web/src/features/staff/`, `apps/web/src/lib/staff-api.ts` | depends on FEAT-CASE, FEAT-ORBIT |
| FEAT-ORBIT | Orbit context integration — identidade, sessão, registros, saque, depósito, operação, retiro, resumo do cliente, customer summary, mascaramento, masking, indisponível, unavailable, diretório de atendentes, staff directory, papéis, roles | `docs/features/FEAT-ORBIT/CONTEXT.md` | RULE-SUP-01, -05, -07 | `apps/api/src/identity/`, `packages/shared/src/identity.ts`, `packages/shared/src/orbit.ts`, `apps/web/src/features/staff/OrbitCustomerSection.tsx` | used by every guarded surface; record cards arrive in PH-4.2 |
| FEAT-NOTIFY | Notifications and availability — notificação, horário de atendimento, e-mail | `docs/features/FEAT-NOTIFY/CONTEXT.md` (pending) | RULE-SUP-08 | — | PH-6 |
| FEAT-ACCESS | Access recovery and privacy — não consigo acessar, recuperação, permissões, permisos | `docs/features/FEAT-ACCESS/CONTEXT.md` (pending) | RULE-SUP-01, -04 | — | PH-7 |

## Document catalog
| Family | Location | Notes |
|---|---|---|
| Governance | `GOVERNANCE.md` | Reusable across projects; §0.1 says which sections to read |
| Product context | `PROJECT_CONTEXT.md` | Objectives OBJ-SUP-01..05 (§2), rules RULE-SUP-01..10 (§8), defaults and unknowns (§13) |
| Entrypoint | `CLAUDE.md` | Startup route and project bindings |
| Live state | `CURRENT_STATE.md`, `SESSION_HANDOFF.md` | |
| Roadmap and phases | `docs/phases/ROADMAP.md`, `docs/phases/PH-N.md`, `docs/phases/PH-N.M.md` | Audit ledger lives in ROADMAP |
| Decisions | `docs/decisions/DECISION_LOG.md`, `docs/decisions/ADR-NNNN-*.md` | |
| Backlog | `docs/BACKLOG.md` | Repository fallback (DEC-0001) |
| Features | `docs/features/<FEAT-ID>/CONTEXT.md` | Four live contexts (see topic routes); each owns its freshness metadata |
| Shared contracts | `packages/shared/src/cases.ts`, `packages/shared/src/identity.ts`, `packages/shared/src/orbit.ts` | Vocabulary, zod schemas, types, reference formatting, simulated-identity headers, Orbit summary/lookup shapes and masking |
| API modules | `apps/api/src/cases/`, `apps/api/src/identity/`, `apps/api/src/database/`, `apps/api/src/events/`, `apps/api/src/attachments/` | Case service + controllers (incl. SSE and attachment endpoints); Orbit identity boundary; Drizzle schema and PGlite factory (migrations in `apps/api/drizzle/`); case event bus + stream service (ADR-0004); attachment storage port, sniffing and service (DEC-0009) |
| Web modules | `apps/web/src/features/support/`, `apps/web/src/features/staff/`, `apps/web/src/features/shell/`, `apps/web/src/lib/`, `apps/web/src/i18n/` | Customer panel (home, new request, conversation); staff workspace at `/staff` (queues, case view, context); simulated Orbit shell; API clients, SSE client (`apps/web/src/lib/sse.ts`) + simulated sessions; pt-BR dictionary |
| UI evidence | `scripts/ui-smoke.mjs`, `docs/evidence/screenshots/` | Playwright browser smoke and its screenshots per subphase |
| Architecture | `docs/architecture/` (pending) | Not created yet: the structure is described by ADR-0002/0003/0004 and the feature contexts; create the directory when a cross-cutting map is needed |
| Runbooks | `docs/runbooks/VERIFICATION.md` | Setup, gate profiles, running the apps, CI |
| Controls | `scripts/check-context.mjs` | Link + lifecycle consistency; limits in the script header |
| Evidence | `docs/evidence/` | One record per work item or material run, e.g. `docs/evidence/PH-1.1-verification.md`; audit remediation in `docs/evidence/CYCLE-1-verification.md` |
| Audits | `docs/audits/` | `CYCLE-1.md` (closed 2026-09-14); one record per cycle |
