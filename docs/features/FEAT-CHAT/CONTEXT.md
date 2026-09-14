# Customer support chat
Type: FEATURE CONTEXT
Feature ID: FEAT-CHAT
Lifecycle: PARTIAL
Freshness: CURRENT
Verified against: the Cycle Audit 2 remediation commit (child of `70630c4`) — covers PH-5.4..PH-6.3 and the audit fixes
Verified on: 2026-09-14
Scope: `apps/web/src/features/support/`, `apps/web/src/features/shell/`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/sse.ts`, `apps/web/src/lib/simulated-session.ts`, `apps/web/src/i18n/`, `apps/web/next.config.ts`; API surface `/api/support/cases*` including `/:id/stream` (owned by FEAT-CASE)

## User outcome and applicable product rules
A signed-in Orbit customer reaches support from a consistent "Suporte" entrypoint, explains a problem with little friction, gets a reference, and finds the conversation again later — from the panel, after reload, on mobile (`PROJECT_CONTEXT.md` §4, OBJ-SUP-01, OBJ-SUP-04).
Rules: RULE-SUP-01 (only own cases), RULE-SUP-03 (no silent loss on retry/disconnect), RULE-SUP-06 (continue unresolved matters), RULE-SUP-08 (availability copy reflects reality — no response-time promise until PH-6/BL-002).

## Current behavior and known gaps
Implemented (PH-1.3, refined in PH-1.4):
- Simulated Orbit shell: side panel ≥ 900 px, full-screen view below, toggled from the topbar; simulated-account picker, always labeled **Simulação**.
- Home: availability copy, "Falar com o suporte", lists "Conversas em andamento" / "anteriores", honest empty/error states with retry. Opening the panel creates nothing.
- New request: five topic chips + message; send disabled until both; `clientMessageId` kept across retries so a failure never creates a second case; on success the panel lands in the conversation.
- Conversation: reference, pt-BR status label, own vs staff (by name) vs system messages, composer (Enter sends), pending → failed "Não enviada" + "Reenviar" with the same id, closed-case notice instead of composer, monotonic request counter (FND-0002) so a refresh never hides a just-sent message.
- Live updates (PH-2.1, ADR-0004): the open conversation subscribes to `/api/support/cases/:id/stream` (fetch-based SSE with the identity header); `message.created` is applied at once, `case.updated` triggers a re-read, every (re)connect resyncs; polling drops to a 60 s safety net while connected (5 s otherwise). Measured delivery 73 ms staff → customer.
- Delivery states (PH-2.2): unread badges on the home lists (fed by `/api/support/cases/stream`), automatic read marking while the conversation is visible (`POST …/read`), connection indicator "Ao vivo / Reconectando… / Sem conexão", and automatic resend of failed messages on reconnect with the same `clientMessageId` — observed with network emulation: sent once, shown once on both sides.
- Attachments (PH-2.3): "Anexar arquivo" in the composer uploads immediately and shows each file's state (enviando / tamanho / recusado com motivo); ready ids are linked when the message is sent; images render as thumbnails fetched with the identity header (blob URLs), PDFs as chips with "Abrir"; unavailable files show a state instead of a broken image.
- Resolution (PH-3.1): a resolved case shows a notice with the staff explanation in the conversation and the button "Ainda preciso de ajuda", which sends "Ainda preciso de ajuda." and reactivates the same case (§7.2); "Aguardando sua resposta" is shown while staff wait for the customer.
- Closure (PH-3.4): a closed case replaces the composer with the closure notice and a form whose button "Preciso de mais ajuda" opens a linked continuation and navigates to it; a continuation shows "Continuação do caso SUP-…" with "Ver caso anterior".
Reliability and privacy on the client (Cycle Audit 1, FND-0011/0012/0021): the panel is keyed by the simulated customer, so changing identity never leaves another customer's conversation on screen; a 401/403/404 on refresh clears the conversation and stops polling; the stream client stops on those statuses. A send refused with 409 `case_closed` moves the text into the follow-up form (same client id); other 4xx show "Recusada pelo servidor" with "Descartar" and are never auto-retried; failed messages persist in `sessionStorage` per customer and case and are retried after "Voltar" or a reload; mutations time out after 20 s. Read receipts are sent only while the panel is actually on screen (desktop, or mobile with the panel open); becoming visible marks unread replies. The home resyncs on every stream (re)connect. Customer responses no longer carry staff-only fields (DEC-0015) — the customer UI never needed them.
Outside hours (PH-6.3): writing while support is closed shows the system "Aviso" with the next opening in the conversation; the home's availability line already said "Atendimento fechado agora."
E-mail preference and outbox (PH-6.2, FEAT-NOTIFY): the home offers "Receber e-mail quando houver resposta e eu não tiver visto" and a labeled "E-mails que seriam enviados (Simulação)" list whose entries open the conversation.
Notifications (PH-6.1, FEAT-NOTIFY): the host's "Notificações" button carries the unread count and opens the panel on the notified case; opening a conversation marks its notifications read (`POST /support/cases/:id/read`). Cycle Audit 2: the bell is keyed by customer and its identity is memoised, so a host re-render never re-opens the stream (FND-0034) and a switched identity never shows another customer's notifications (FND-0035); a failed load says "Não foi possível carregar as notificações." with a retry; the records list is remembered with its owner (FND-0055); the home reports a failed preference save ("o valor anterior continua valendo") and a failed outbox load instead of an empty state (FND-0041).
Availability (PH-5.4, RULE-SUP-08): the home shows "Atendimento aberto/fechado agora", today's window or "Hoje não há atendimento", the next opening, and whether the schedule is still a working default ("ainda não configurado pela operação") or configured (with the zone) — from `GET /api/support/availability`; no response-time promise anywhere.
Contextual entry (PH-4.2, §4.2): the simulated host lists the customer's records ("Seus registros", labeled Simulação) with "Preciso de ajuda" per record; the request form shows the record card, preselects the topic from the record's kind and lets the customer remove the record ("Remover registro" — the question becomes general); when the record already has an active case the form offers "Continuar conversa" and disables sending until "É outro problema"; the conversation shows the card with the snapshot captured at opening, or "Registro não encontrado no Orbit…" / "O Orbit não respondeu…" when the boundary could not answer (RULE-SUP-07).
Access recovery (PH-7.1, FEAT-ACCESS): the host topbar link "Não consigo acessar minha conta" opens a session-less form in place of the trading placeholder; it sends no simulated identity and shows only a `REC-` reference and the next step.
Sign-out (PH-7.3, DEC-0030): "Sair" in the topbar leaves the neutral "Quem está usando este dispositivo?" picker — no panel, bell, records or drafts; the host signs out after 30 min idle with "Sua sessão foi encerrada por inatividade."; the simulated hooks return `null` while signed out so nothing identity-bound mounts.
Gaps (accepted target): attachments on the first message of a new case (BL-010); Spanish locale (structure ready, content later).

## Dependencies and consumers
Depends on: FEAT-CASE endpoints and contracts (`@orbit-support/shared`), FEAT-ORBIT identity (simulated header `x-simulated-customer-id`), Next rewrites `/api/*` → `API_ORIGIN`.
Used by / affects: the future Orbit host (placement, §4.1) and FEAT-NOTIFY (deep links back into a conversation). Copy lives only in `apps/web/src/i18n/pt-BR.ts`; components never hard-code text.

## Where to work
- Panel state machine: `apps/web/src/features/support/SupportPanel.tsx`; screens `SupportHome.tsx`, `NewRequestForm.tsx`, `CaseConversation.tsx`; `StatusBadge.tsx`; styles `support.module.css`.
- Shell/placement: `apps/web/src/features/shell/OrbitShell.tsx`, `shell.module.css`.
- API client: `apps/web/src/lib/api.ts` (`customerApi`, `newClientMessageId`).
- Tests: `apps/web/src/features/support/*.test.tsx` (Vitest + Testing Library, `mockFetch` helper in `test-utils.ts`), `apps/web/src/i18n/i18n.test.ts`. Browser evidence: `scripts/ui-smoke.mjs`.

## Important failure and permission behavior
The browser only ever sends the current simulated customer's header; the API enforces ownership (404 for others). Network failure on create/send shows an error and keeps the draft and id for retry. Load errors show retry (home) or an alert (conversation); a transient refresh error never wipes an already loaded conversation, but a 401/403/404 does (the case is not this customer's). Nothing here may promise response times or show agents online (RULE-SUP-08).

## Decisions and assumptions
DEC-0006 (CSS Modules, rewrites, polling, Playwright smoke), DEC-0003 (simulated identity, labeled). Assumptions: Orbit will host the panel as a side panel on desktop and full screen on mobile (context §13.1 working default); the topbar picker disappears when a real session exists.

## Verification and change checklist
Component change → `npm test -w web`, `npm run lint -w web`; layout/copy change → `npm run build` + `scripts/ui-smoke.mjs` (screenshots under `docs/evidence/screenshots/`); vocabulary change → dictionary test. Last scoped evidence: `docs/evidence/PH-5.4-verification.md`, `docs/evidence/PH-4.2-verification.md`.
