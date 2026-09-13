# Orbit Support

Customer-service capability for Orbit, a trading platform: human chat support for customers and a case workspace for the support team.

- Agents and contributors start at [`CLAUDE.md`](CLAUDE.md).
- Product definition: [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md). Working rules: [`GOVERNANCE.md`](GOVERNANCE.md).
- Setup and verification commands: [`docs/runbooks/VERIFICATION.md`](docs/runbooks/VERIFICATION.md).

Layout: `apps/web` (Next.js customer + staff UI), `apps/api` (NestJS application), `packages/*` (shared code, when needed), `docs/` (context, phases, decisions, evidence).
