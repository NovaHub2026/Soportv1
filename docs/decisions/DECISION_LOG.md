# DECISION LOG
Type: DECISION LOG
Smaller material decisions (`GOVERNANCE.md` §2.3). Durable decisions are ADRs in this directory and are listed here for discoverability.

| ID | Date | Decision | Authority | Status | Related |
|---|---|---|---|---|---|
| ADR-0001 | 2026-09-13 | Adopt GOVERNANCE.md Edition 3.1; project bindings in `CLAUDE.md` | Owner | ACCEPTED | §15.1 |
| ADR-0002 | 2026-09-13 | Dedicated project; explicit Orbit integration boundary; labeled simulation until access exists | Agent (delegated) | ACCEPTED | PH-1, PH-4, BL-001 |
| DEC-0001 | 2026-09-13 | Backlog kept in `docs/BACKLOG.md` until an issue tracker is chosen; no competing backlogs | Agent (delegated) | ACCEPTED | §3.1 |
| DEC-0002 | 2026-09-13 | Git author for Agent commits set repo-locally to `NovaHub2026 <orbitmarket.pro@gmail.com>` — no identity existed on the machine; the name is the authenticated GitHub login | Agent; Owner may change | ACCEPTED | `CLAUDE.md` |
| DEC-0003 | 2026-09-13 | No Orbit system exists yet. All Orbit identity/record context is simulated behind the ADR-0002 boundary and labeled as simulation in UI and docs. Owner: «Actualmente no hay ningún repositorio asi que tendremos que hacer todo con datos simulados» | Owner | ACCEPTED | ADR-0002, BL-001, PH-4 |
| DEC-0004 | 2026-09-13 | Workspace tooling: npm workspaces `apps/*`, `packages/*` (npm 11 present, pnpm not installed). Framework scaffolds kept: Next 16 (ESLint, TypeScript 5) and Nest 12 (ESM, TypeScript 6, Vitest, oxlint, Prettier). Vitest + jsdom + Testing Library added to web. Gate profiles context / static / unit / verify / full, with builds outside `verify` to keep the per-commit gate fast. API dev port 3001. Revisit: align TypeScript versions when Next supports TS 6 (BL-005); add API e2e to CI when contracts exist | Agent (delegated) | ACCEPTED | PH-1.1, `../runbooks/VERIFICATION.md` |
