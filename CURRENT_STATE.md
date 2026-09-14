# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-5.md`; base checkpoint: the PH-5.2/PH-5.3 commit on `main` (child of `3217c53`)

| Field | Value |
|---|---|
| Active objective / feature | PH-5 staff workspace completeness and supervision (OBJ-SUP-03): views for every state and attention signals (done), filters/search, saved replies, schedule/config with honest availability copy, supervision overview, service metrics. |
| Active phase / subphase | PH-5 `ACTIVE` (`docs/phases/PH-5.md`). PH-5.1, PH-5.2, PH-5.3 `APPROVED` 2026-09-14; PH-5.4 `PLANNED` (schedule/configuration, supervision overview, metrics, closure). PH-1..PH-4 `APPROVED`. |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 1/3 (PH-4), open cycle, no debt. |
| Blocking decisions / dependencies | None. PH-4 depends on ADR-0002 (boundary) and BL-001 (resolved: everything simulated, DEC-0003). |
| Integration / CI / release | Candidate: the PH-5.2/PH-5.3 commit on `main`. Local: `npm run verify` exit 0, `npm run build` exit 0, browser smoke 43/43 — `docs/evidence/PH-5.3-verification.md` (CI verdict recorded there when known). **`3217c53` (PH-5.1) was committed with a failed gate and CI red — FND-0028, corrected by this commit; see `docs/evidence/PH-5.1-verification.md`.** Release: none, not authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0; earlier sessions ran on WSL2. The repo-local git author (DEC-0002) must be re-set on every fresh clone — see `docs/runbooks/VERIFICATION.md` "Setup". |
| Context route | `CONTEXT_INDEX.md` → four live feature contexts (all re-verified against the remediation commit); audit record `docs/audits/CYCLE-1.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Plan and run PH-5.4 (`docs/phases/PH-5.4.md`, to be created): `support_settings` (operating schedule per weekday with timezone, attention threshold in hours, follow-up window) editable by supervisors/admins and attributed; customer availability copy computed from the schedule (RULE-SUP-08: "Atendimento seg–sex 9h–18h (horário configurado)" / outside hours: "Fora do horário: sua mensagem fica registrada…", no promise not configured); supervision overview (counts by status, unassigned age, oldest unanswered, per-agent load, overdue follow-up list with reassignment); service metrics from `case_events` for a period (time to first human reply, age of unanswered, time to resolution, reopen rate — labeled computed, no targets: BL-002); then close PH-5 with a phase approval record (scenarios a–g).
Why now: PH-5.1–5.3 are approved; PH-5.4 is the closing block of the active phase.
Preconditions: CI green on the PH-5.2/5.3 commit (`gh run list --limit 3`, record it in `docs/evidence/PH-5.3-verification.md`); tree clean; `npm run verify` passes. Process rule reinforced by FND-0028: never chain a commit after `verify` with `;` — use `&&`, and never keep unfinished files of a later block in the tree at commit time.
Evidence/read first: `docs/phases/PH-5.md` (scenarios c, f, g); `PROJECT_CONTEXT.md` §4.4, §5.4, §13.2, §14 (success signals paragraph); `docs/BACKLOG.md` BL-002.
If preconditions fail: CI red → diagnose before any PH-4 work (§9.2). Unknown local changes → attribute and preserve (§4.3).
