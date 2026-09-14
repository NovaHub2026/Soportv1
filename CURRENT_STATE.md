# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-13
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-1.md`; base checkpoint: PH-1.2 commit on `main` (child of `151d31f`)

| Field | Value |
|---|---|
| Active objective / feature | PH-1 end-to-end case skeleton (OBJ-SUP-01, OBJ-SUP-03). API and persistence exist; UIs do not. Feature contexts are written in PH-1.5. |
| Active phase / subphase | PH-1 `ACTIVE`. PH-1.1, PH-1.2 `APPROVED` (2026-09-13). PH-1.3 `PLANNED`, next. No subphase active. |
| Audit | Cycle 1: 0/3 first-time phase approvals; not due; no inherited debt. |
| Blocking decisions / dependencies | None. Styling approach for the web app (Tailwind vs CSS modules) is decided at the start of PH-1.3 (decision log). |
| Integration / CI / release | Candidate: PH-1.2 commit on `main`. Local: `npm run verify` exit 0 (`docs/evidence/PH-1.2-verification.md`). CI: awaiting corroboration — verdict in that file, section "CI". Release: not applicable. |
| Context route | `CONTEXT_INDEX.md` → `docs/phases/PH-1.md` → `docs/phases/PH-1.2.md`; API surface in `apps/api/src/cases/`; contracts in `packages/shared/src/`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Start PH-1.3 — customer "Suporte" panel in `apps/web` (pt-BR): entry with prominent "Falar com o suporte", new request (topic + message), own cases list, conversation view with send. Set PH-1.3 `ACTIVE` in `docs/phases/PH-1.md`, create its subphase document, read `apps/web/AGENTS.md` and the Next.js docs it points to before writing components.
Why now: the API journey is verified; the phase outcome requires the screen, not the API (§6.3).
Preconditions: `npm run verify` passes on HEAD; tree clean or attributable; CI green on HEAD or its failure diagnosed first.
Evidence/read first: `PROJECT_CONTEXT.md` §4.1–4.3, §10.1 (brand: dark, `#0048FF`, `#FF7900`, Inter; pt-BR); `packages/shared/src/cases.ts` (contracts); `docs/phases/PH-1.2.md` (endpoints and simulated identity headers).
If preconditions fail: CI red → diagnose and fix first. Unknown local changes → attribute and preserve (§4.3).
