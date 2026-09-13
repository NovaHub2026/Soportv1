# PH-1.1 — Workspace scaffold and verification gate
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-1.md`
Feature context: none yet (foundation work; FEAT-* contexts are written in PH-1.5)

## Objective, prerequisites and scope
Produce an executable, verifiable workspace on the confirmed stack so PH-1.2+ can deliver behavior with evidence: npm-workspaces monorepo with `apps/web` (Next.js 16, React 19, TypeScript) and `apps/api` (NestJS 12, TypeScript), a verification gate with named profiles, a CI workflow, the verification runbook and the context consistency checker (BL-003).
Prerequisites: adoption commit `4da2ac2`; Node 24 / npm 11 present. Out of scope: any product behavior, database, shared package (created when the first contract exists in PH-1.2).

## Affected boundaries and implementation approach
- Root `package.json` with workspaces `apps/*`, `packages/*`; scripts fan out with `npm run <script> --workspaces --if-present`.
- `apps/web`: `create-next-app@16.3.5 --empty` (App Router, `apps/web/src/`, ESLint, no Tailwind — styling decided in PH-1.3). Added Vitest + jsdom + Testing Library and `typecheck` = `next typegen && tsc --noEmit`.
- `apps/api`: `@nestjs/cli@12.0.0 new --strict` (ESM, TypeScript 6, Vitest, oxlint, Prettier — framework defaults kept). Added `typecheck`; default port 3001 so both dev servers coexist.
- `scripts/check-context.mjs`: link + lifecycle consistency (see its header for scope and limits).
- `.github/workflows/ci.yml`: `npm ci && npm run verify` on push to `main` and PRs.
- `apps/web/CLAUDE.md` reduced to a pointer to the canonical entrypoint plus the framework-generated `AGENTS.md`.

## Required behavior, failures and acceptance evidence
- `npm run verify` runs context → static → unit and fails on the first non-zero layer.
- Vitest discovers at least one test in each app; an empty discovery fails.
- `check-context` fails on a missing referenced path and on lifecycle inconsistencies (negative case required — §7.3).
- CI workflow executes the same gate on the pushed candidate.
Acceptance: gate EXECUTED locally on the candidate with exit 0; negative case EXECUTED; CI verdict recorded separately.

## Work performed and important decisions
- Scaffolded `apps/web` and `apps/api` with the framework CLIs; root workspace `package.json`, `.gitignore`, `.nvmrc`, `README.md`.
- Added web test tooling (Vitest, jsdom, Testing Library) and one discovery test per app; `typecheck` scripts in both apps.
- Replaced the `vite-tsconfig-paths` plugin with Vite's native `resolve.tsconfigPaths` in all Vitest configs (the plugin warned it is superseded).
- Fixed the Nest scaffold's e2e spec (`supertest/types` import fails under nodenext + TypeScript 6).
- Wrote `scripts/check-context.mjs`, `.github/workflows/ci.yml`, `docs/runbooks/VERIFICATION.md`.
- Decisions: DEC-0004 (tooling, layout, profiles, ports) in `../decisions/DECISION_LOG.md`.

## Verification, limitations and context updates
Evidence: `../evidence/PH-1.1-verification.md` — every local layer EXECUTED with exit 0 on the candidate; checker negative case EXECUTED; CI verdict recorded there separately (post-integration).
Limitations: no browser/e2e UI tests; e2e API profile outside CI; check-context does not yet compute audit debt (BL-004).
Context updated: `ROADMAP.md`, `PH-1.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `CLAUDE.md`, `../BACKLOG.md`, `../decisions/DECISION_LOG.md`.
Approved on 2026-09-13 by the Agent (evidence-based delivery decision, §6.3; not a human review).
