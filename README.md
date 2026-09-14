# Orbit Support

Customer-service capability for Orbit, a trading platform: human chat support for customers and a case workspace for the support team.

- Agents and contributors start at [`CLAUDE.md`](CLAUDE.md).
- Product definition: [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md). Working rules: [`GOVERNANCE.md`](GOVERNANCE.md).
- Setup and verification commands: [`docs/runbooks/VERIFICATION.md`](docs/runbooks/VERIFICATION.md).
- Project status (2026-09-14): reopened for PH-13, Orbit integration readiness ([`docs/phases/PH-13.md`](docs/phases/PH-13.md), map [`docs/integration/ORBIT-INTEGRATION.md`](docs/integration/ORBIT-INTEGRATION.md)); PH-11, the AI assistant, is the Owner's build from [`docs/phases/PH-11.md`](docs/phases/PH-11.md); closure record [`docs/evidence/PH-12-phase-approval.md`](docs/evidence/PH-12-phase-approval.md); internal demo `v0.2.0-demo` ([`docs/evidence/RELEASE-2026-09-14c.md`](docs/evidence/RELEASE-2026-09-14c.md)).

Layout: `apps/web` (Next.js customer + staff UI), `apps/api` (NestJS application), `packages/*` (shared code, when needed), `docs/` (context, phases, decisions, evidence).
