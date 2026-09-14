# PH-1.3 — Customer "Suporte" panel
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-1.md`
Feature context: none yet (FEAT-CHAT / FEAT-CASE contexts are written in PH-1.5)

## Objective, prerequisites and scope
Give a signed-in (simulated) customer the "Suporte" experience from `PROJECT_CONTEXT.md` §4.1–4.3 in `apps/web`, Brazilian Portuguese: a consistent entrypoint (side panel on desktop, full-screen on mobile), a prominent "Falar com o suporte" action, a short topic + message form, the list of active and previous conversations, and one conversation with a composer, send/failed states and staff replies attributed by name. Prerequisite: PH-1.2 API. Out of scope: attachments, live delivery, unread badges and notifications (PH-2, PH-6), contextual entry from a record (PH-4), staff UI (PH-1.4).

## Affected boundaries and implementation approach
- `apps/web/next.config.ts`: rewrites `/api/*` → API (`API_ORIGIN`, default `http://localhost:3001`) so the browser stays same-origin.
- `apps/web/src/app/`: root layout (`lang="pt-BR"`, Inter via `next/font/google`, `apps/web/src/app/globals.css` tokens: dark surface, `#0048FF`, `#FF7900`); the page renders the simulated Orbit shell.
- `apps/web/src/features/shell/OrbitShell.tsx` (client): topbar with brand, **Simulação** badge + simulated-account picker, "Suporte" toggle; trading placeholder; `<aside>` hosting the panel. CSS module handles desktop side panel vs mobile full-screen (`max-width: 899px`).
- `apps/web/src/features/support/`: `SupportPanel` (view state: home / new / case), `SupportHome` (availability copy, CTA, active/previous lists), `NewRequestForm` (radio chips for the 5 categories, textarea, zod validation from shared, stable `clientMessageId` per attempt series), `CaseConversation` (5 s refresh, optimistic pending messages with failed/retry keeping the same `clientMessageId`, closed-case notice), `StatusBadge` (text + tone). One CSS module.
- `apps/web/src/lib/api.ts` (typed client adding the simulated identity header), `apps/web/src/lib/simulated-session.ts` (`useSyncExternalStore` over `localStorage`), `apps/web/src/i18n/` (pt-BR dictionary keyed by shared vocabulary; `getDictionary(locale)` ready for `es`).
- `scripts/ui-smoke.mjs` (Playwright, root devDependency): boots built API + web and drives the real panel in Chromium, saving screenshots to `docs/evidence/screenshots/`.

## Required behavior, failures and acceptance evidence
- Opening the panel creates nothing; sending the first message creates the case and lands in its conversation with the reference visible (§4.1).
- Send is disabled until topic and message exist; a network failure shows an error and a retry reuses the same `clientMessageId` (no duplicate case — RULE-SUP-03).
- The conversation distinguishes own messages, staff (by name) and system notices; a failed send is marked "Não enviada" with "Reenviar"; a closed case shows a notice instead of the composer.
- Statuses appear as pt-BR text per context §7; categories per §4.1.
- Another simulated customer sees an empty history (RULE-SUP-01 at the UI).
- Mobile: panel hidden until "Suporte" is tapped, then full screen; desktop: side panel that never covers the trading area.
Acceptance evidence: `../evidence/PH-1.3-verification.md` (13 component tests EXECUTED; 8 browser observations OBSERVED with screenshots).

## Work performed and important decisions
DEC-0006: CSS Modules + CSS variables (no Tailwind), same-origin `/api` rewrites, 5 s polling until PH-2, Playwright browser smoke as the UI evidence mechanism. Copy kept calm and honest: the availability text promises no response time (BL-002; PH-6 will show the real schedule).

Known gaps carried forward: unread indicators and notifications (PH-2/PH-6); the panel is a standalone shell because Orbit does not exist (DEC-0003); `SupportHome` refetches only on mount/retry (fine with the view state machine; revisit with live updates).

## Verification, limitations and context updates
Evidence: `../evidence/PH-1.3-verification.md`. Limitations: Chromium in this environment needed four system libraries extracted locally (BL-007); the smoke uses fixed API port 3001 because the web build bakes the rewrite target; no visual regression baseline yet.
Context updated: `PH-1.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `../runbooks/VERIFICATION.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
