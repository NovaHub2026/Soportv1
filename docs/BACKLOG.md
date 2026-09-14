# BACKLOG
Type: BACKLOG — repository fallback (DEC-0001)
Updated: 2026-09-13

| ID | Type | Item | Impact / why | Owner / next step | Status |
|---|---|---|---|---|---|
| BL-001 | Decision | Access to Orbit's code, API or environment for real identity/record integration | Resolved 2026-09-13: the Owner confirmed no Orbit repository or API exists (DEC-0003). Not a blocker — a fact. All Orbit context is simulated behind the ADR-0002 boundary. Reopen as integration work when an Orbit system exists | Owner informs when Orbit exists; Agent keeps the boundary narrow | RESOLVED |
| BL-002 | Operational unknown | Staffing, hours, response targets, roles/specialist contacts, account-recovery procedure, retention/complaints policy (context §13.2) | Needed before honest production claims (RULE-SUP-08) and PH-8 | Owner/Operations; not blocking PH-1..7 | OPEN |
| BL-003 | Process | Automated state/link consistency check for context documents | Guards documentation drift as the repo grows (§7.5) | Done in PH-1.1: `../scripts/check-context.mjs`; control status PARTIAL (see BL-004) | DONE |
| BL-004 | Process | Extend `check-context` with an audit-debt check (first-time phase approvals in the ledger vs cadence) | State-integrity control becomes relevant at the first phase approval (§6.4, §16.7) | Agent; activate at PH-1 approval | PLANNED |
| BL-005 | Tech debt | TypeScript 6 in `apps/api` vs TypeScript 5 in `apps/web` | Two compiler majors in one workspace; harmless now, confusing later | Agent; align when Next/eslint-config-next support TS 6 | OPEN (low) |
| BL-006 | Tech debt | npm 11 `allow-scripts` warning: `unrs-resolver` postinstall not allowed | ESLint import resolution passes today; may break on upgrade | Agent; approve the script (`npm approve-scripts`) only if lint breaks | OPEN (low) |
| BL-007 | Environment | Playwright Chromium lacks system libraries on this machine (`libnspr4`, `libnss3`, `libasound2`); no passwordless sudo | UI smoke needs a local `LD_LIBRARY_PATH` workaround (runbook) | Owner: run `sudo npx playwright install-deps chromium` once to remove the workaround | OPEN (low) |
| BL-008 | Process | Add the UI smoke (or a Playwright test suite) to CI once it runs in a clean container | Browser evidence is produced locally only | Agent; consider at PH-2 when the smoke grows | PLANNED |
