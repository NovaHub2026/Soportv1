# Customer support chat
Type: FEATURE CONTEXT
Feature ID: FEAT-CHAT
Lifecycle: PARTIAL
Freshness: CURRENT
Verified against: `c628d8b` plus the PH-2.3 change (attachments)
Verified on: 2026-09-13
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
Gaps (accepted target): attachments on the first message of a new case (BL-010); in-product notifications outside the conversation (PH-6); contextual entry from a record with a card ("Preciso de ajuda", PH-4); "Ainda preciso de ajuda" / linked follow-up from closed (PH-3); "Não consigo acessar minha conta" route (PH-7); Spanish locale (structure ready, content later).

## Dependencies and consumers
Depends on: FEAT-CASE endpoints and contracts (`@orbit-support/shared`), FEAT-ORBIT identity (simulated header `x-simulated-customer-id`), Next rewrites `/api/*` → `API_ORIGIN`.
Used by / affects: the future Orbit host (placement, §4.1) and FEAT-NOTIFY (deep links back into a conversation). Copy lives only in `apps/web/src/i18n/pt-BR.ts`; components never hard-code text.

## Where to work
- Panel state machine: `apps/web/src/features/support/SupportPanel.tsx`; screens `SupportHome.tsx`, `NewRequestForm.tsx`, `CaseConversation.tsx`; `StatusBadge.tsx`; styles `support.module.css`.
- Shell/placement: `apps/web/src/features/shell/OrbitShell.tsx`, `shell.module.css`.
- API client: `apps/web/src/lib/api.ts` (`customerApi`, `newClientMessageId`).
- Tests: `apps/web/src/features/support/*.test.tsx` (Vitest + Testing Library, `mockFetch` helper in `test-utils.ts`), `apps/web/src/i18n/i18n.test.ts`. Browser evidence: `scripts/ui-smoke.mjs`.

## Important failure and permission behavior
The browser only ever sends the current simulated customer's header; the API enforces ownership (404 for others). Network failure on create/send shows an error and keeps the draft and id for retry. Load errors show retry (home) or an alert (conversation); a refresh error never wipes an already loaded conversation. Nothing here may promise response times or show agents online (RULE-SUP-08).

## Decisions and assumptions
DEC-0006 (CSS Modules, rewrites, polling, Playwright smoke), DEC-0003 (simulated identity, labeled). Assumptions: Orbit will host the panel as a side panel on desktop and full screen on mobile (context §13.1 working default); the topbar picker disappears when a real session exists.

## Verification and change checklist
Component change → `npm test -w web`, `npm run lint -w web`; layout/copy change → `npm run build` + `scripts/ui-smoke.mjs` (screenshots under `docs/evidence/screenshots/`); vocabulary change → dictionary test. Last scoped evidence: `docs/evidence/PH-1.3-verification.md`, `docs/evidence/PH-1.4-verification.md`.
