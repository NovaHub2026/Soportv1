# Orbit Support (Soportv1) — Agent entrypoint

Type: OPERATIONAL ENTRYPOINT
Canonical entrypoint for this repository (`GOVERNANCE.md` §0.2, §3.1). Other provider wrappers, if ever added, must only point here.

## Startup route (fresh session)
1. `GOVERNANCE.md` §0 and §1, then the §0.1 table for the situation at hand.
2. `PROJECT_CONTEXT.md` §1–2 and §8 for product orientation; the full document on a changed objective or a relevant ambiguity.
3. `CURRENT_STATE.md`, then `SESSION_HANDOFF.md` — check running work and preservation before touching the tree.
4. Inspect actual Git state (branch, HEAD, status, remote) and compare with `docs/phases/ROADMAP.md`.
5. Route the task through `CONTEXT_INDEX.md`; load only the linked feature/phase context.

## Bindings
| Binding | Value |
|---|---|
| Governance | `GOVERNANCE.md` Edition 3.1, adopted 2026-09-13 (ADR-0001) |
| Product context | `PROJECT_CONTEXT.md` v1.0, Owner-supplied 2026-09-13 |
| State / handoff | `CURRENT_STATE.md`, `SESSION_HANDOFF.md` |
| Index | `CONTEXT_INDEX.md` — topic routing + document catalog, one file while small |
| Roadmap / ledger | `docs/phases/ROADMAP.md`; phase and subphase docs in `docs/phases/` |
| Decisions | `docs/decisions/DECISION_LOG.md`; ADRs in `docs/decisions/` |
| Evidence / audits | `docs/evidence/`, `docs/audits/` — created with the first run / audit |
| Backlog | `docs/BACKLOG.md` — repository fallback; no external tracker chosen (DEC-0001) |
| Remote | `origin` → github.com/NovaHub2026/Soportv1 (inspected 2026-09-13); integration branch `main` |
| Git author (repo-local) | `NovaHub2026 <orbitmarket.pro@gmail.com>` (DEC-0002) |
| Confirmed stack | Frontend: React + Next.js + TypeScript. Backend: NestJS + TypeScript. Everything else is decided per ADR/decision log as needed. |
| Verification | `docs/runbooks/VERIFICATION.md` — run `npm run verify` before every commit (profiles: context, static, unit, verify, full) |
| CI / release authorization | GitHub Actions `.github/workflows/ci.yml` runs `verify` on push to `main` and PRs; it runs post-integration, so a push is awaiting corroboration until green (§9.2). Release authorization: none granted; production release requires the Owner (§1.1). |
| Audit cadence | Cycle Audit after 3 first-time phase approvals (§6.4). Inherited debt: none. Independent review: subagents are available in this runtime. |
| Languages | Developer artifacts: English. Owner communication: Spanish. Customer UI: pt-BR first, es later. |
| Commands (§12.1) | `START`/resume · `GUARDAR`/save · `PARAR`/stop · `AUDITAR`/audit · `EJECUTA` = execute the current task (new-adoption binding) |

## Local constraints
- Toolchain observed 2026-09-13: Node v24.19.0, npm 11.17.0; pnpm not installed. Runs under WSL2.
- Orbit does not exist yet as a system (Owner, 2026-09-13, DEC-0003). All Orbit identity/record context is simulated behind an explicit boundary (ADR-0002) and must be labeled as simulation in UI and docs.
- Monorepo with npm workspaces: install with `npm ci` at the root, never inside an app. Build `packages/shared` before the apps (`npm run build:shared`). Dev ports: API 3001, web 3000.
- Database: embedded PostgreSQL (PGlite) with Drizzle (ADR-0003); schema changes need `npm run db:generate -w api` and the migration committed.
- Never commit secrets, real customer data or probe code (§11).
