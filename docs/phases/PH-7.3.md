# PH-7.3 — Shared-device sign-out and privacy re-check
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-7.md`
Feature context: `../features/FEAT-ACCESS/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Signing out on a shared device leaves nothing of the previous customer on screen or in the browser (`PROJECT_CONTEXT.md` §10.2, RULE-SUP-01), the staff workspace has the same exit, an idle customer session ends by itself, and the incident / consultation / attachment paths are re-checked under the role model so restricted information never reaches a customer (RULE-SUP-04). Prerequisite: PH-7.2. Out of scope: real sessions (Orbit's), remembering devices, retention.

## Affected boundaries and implementation approach
- Simulated sessions (`apps/web/src/lib/simulated-session.ts`): a `signedOut` state per store (customer, staff) persisted in `localStorage`; `signOut()` clears the selection, every `sessionStorage` key of the app (pending message buffers), and dispatches the change event so every subscriber re-renders; `select()` from the signed-out state is the "sign in" of the simulation.
- Host shell: "Sair" in the topbar; when signed out the shell shows a neutral "Quem está usando este dispositivo?" picker (labeled simulation) and nothing else — no panel, no bell, no records, no drafts; the recovery link stays available. Idle sign-out after `IDLE_SIGN_OUT_MINUTES` (working default 30) without pointer/keyboard activity, with a short notice on return ("Sua sessão foi encerrada por inatividade").
- Staff workspace: "Sair" with the same picker; no idle timeout (agents work on personal desks — §10.2 defers staff protection to Orbit's policies).
- Privacy re-check (evidence only): e2e negatives asserting that an incident note broadcast, a consultation and an internal note never appear in the customer detail, the customer stream, notifications or e-mails after the PH-7.2 changes; attachment access across roles unchanged.

## Required behavior, failures and acceptance evidence
- After "Sair" and a reload, the previous customer's cases, notifications, outbox, records and drafts are absent; the next person chooses an identity and starts clean.
- The idle timeout signs out even with the panel open; activity resets it.
- The staff "Sair" clears the remembered agent.
Acceptance evidence: `../evidence/PH-7.3-verification.md`; phase approval `../evidence/PH-7-phase-approval.md`.

## Work performed and important decisions
- `simulated-session.ts`: a signed-out state per store (`localStorage` flag), `signOut()` clears the selection and every `orbit-support.` session buffer, hooks return `null` while signed out; `clearSessionBuffers()`.
- Host shell: "Sair" in the topbar; `SignedOutShell` (neutral picker, labeled simulation, recovery link, reason line "Você saiu…" / "Sua sessão foi encerrada por inatividade."); nothing identity-bound mounts while signed out. `useIdleSignOut` (30 min working default, activity and visibility reset it).
- Staff workspace: "Sair" and `StaffSignedOut` picker; no idle timeout (§10.2 defers staff protection to Orbit's policies).
- e2e privacy re-check (scenario e) after the role model.
- DEC-0030: sign-out semantics and the idle default.

## Verification, limitations and context updates
Evidence: `../evidence/PH-7.3-verification.md`, `../evidence/PH-7-phase-approval.md`. Limitations: the idle timeout is unit-tested only; sessions and sign-out are simulated (BL-001).
Context updated: `PH-7.md` (APPROVED), `ROADMAP.md` (ledger cycle 3 → 1/3), `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-ACCESS/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../runbooks/VERIFICATION.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
