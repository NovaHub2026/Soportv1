# Verification runbook
Type: RUNBOOK
Scope: root `package.json` scripts, `apps/web`, `apps/api`, `scripts/check-context.mjs`, `.github/workflows/ci.yml`
Verified on: 2026-09-13 (PH-1.1 evidence in `docs/evidence/`)

## Setup
- Node ≥ 24 (`.nvmrc`), npm ≥ 11. Observed locally: Node v24.19.0, npm 11.17.0.
- `npm ci` at the repository root. npm workspaces: `apps/*`, `packages/*`. Do not install inside an app directory.
- No database, environment variables or external services are required yet.

## Profiles (`GOVERNANCE.md` §7.2–7.3)
| Profile | Command | Layers | Use when |
|---|---|---|---|
| context | `npm run check:context` | Link and lifecycle consistency of live context documents | Any documentation or state change; approval-only edits |
| static | `npm run lint && npm run typecheck` | ESLint (web), oxlint (api); `tsc --noEmit` in both apps (web runs `next typegen` first) | Any code change |
| unit | `npm test` | Vitest in `apps/web` (jsdom + Testing Library) and `apps/api` | Behavior change |
| verify | `npm run verify` | context + static + unit, in that order | Before every commit; required CI check |
| full | `npm run verify:full` | verify + production builds (`next build`, `nest build`) | Phase candidate or release candidate |
| api e2e | `npm run test:e2e --workspace api` | Vitest + supertest against the Nest application | API contract changes; not part of CI yet |

Exit codes propagate: the `verify` chain stops at the first failing layer. Vitest exits non-zero when it discovers no test files, so an empty suite cannot pass as green. The report of any run must name the profile that ran; a targeted pass is not a full-project pass.

## Running the applications
| App | Command | URL |
|---|---|---|
| API (NestJS) | `npm run dev:api` | http://localhost:3001 (`PORT` overrides) |
| Web (Next.js) | `npm run dev:web` | http://localhost:3000 |

`next dev` regenerates `apps/web/AGENTS.md`; commit that change with your work if it appears.

## CI
`.github/workflows/ci.yml` runs `npm ci && npm run verify` on every push to `main` and on pull requests. CI runs after integration to `main`, so a push is "awaiting corroboration" until the run completes (§9.2). Check with `gh run list --limit 3` / `gh run view <id>`; record the verdict per candidate in evidence.

## Limitations
- No browser/e2e tests, no coverage threshold, no performance checks.
- `check-context` is mechanical; see the script header for what it does not establish.
- Builds are not part of `verify` (kept in `full`) to keep the per-commit gate fast; run `full` before approving a phase.
