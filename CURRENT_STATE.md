# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-14
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-13.md`; base checkpoint: the PH-13.1 commit (after `aa82f75`)

| Field | Value |
|---|---|
| Active objective / feature | PH-13 — Orbit integration readiness (Owner, 2026-09-14: the broker's frontend `optaqode-frontend2.0` analysed read-only; Orbit Support prepared to connect later). Reopens the project after PH-12's closure; PH-11 stays the Owner's GPT build. Internal loopback demo `v0.2.0-demo` (`docs/evidence/RELEASE-2026-09-14c.md`). |
| Active phase / subphase | PH-13 `ACTIVE`; PH-13.1 `APPROVED` (integration map `docs/integration/ORBIT-INTEGRATION.md`, `optaqode` adapters behind the ports, DEC-0045); next PH-13.2 (the panel inside the broker) `PLANNED`; PH-13.3 (live connection) `PLANNED`, blocked by BL-032. PH-11 `PLANNED` (Owner). |
| Audit | Cycle 1: 3/3 — CLOSED. Cycle 2: 3/3 — CLOSED. Cycle 3: 3/3 — CLOSED 2026-09-14. Cycle 4: 2/3 (PH-10, PH-12); the closing audit `docs/audits/CLOSING.md` was out of band (closed). The next first-time phase approval (PH-13 or PH-11) makes Cycle Audit 4 due. |
| Blocking decisions / dependencies | Owner: the broker's backend answers (BL-032 — token material and person-id claim, a service credential for the admin read endpoints, enumerations, protocol numbers, edge policy) and the support role map (DEC-0045 c, provisional); retention of closed cases and the e-mail provider (BL-002); the AI provider account (BL-031). A production release needs the live connection (PH-13.3), those policies and the Owner's authorization (§1.1). |
| Integration / CI / release | `aa82f75` (PH-12.3 closure) CI run 34876251294: `verify` red only because tag `v0.2.0-demo` was not on `origin` at run time (the Agent's runtime refused the push) — the Owner pushes the tag, then reruns that workflow; the PostgreSQL job passed. The PH-13.1 commit: CI pending at recording time (check `gh run list --limit 2`; it fails for the same reason until the tag is pushed). No production release authorized. |
| Environment (observed 2026-09-14) | Windows 11 native, Git Bash / PowerShell, Node v24.19.0, npm 11.17.0, Docker Engine 29.8.0 (test PostgreSQL on 127.0.0.1:55433). Fresh clone: set the git author (DEC-0002) and `git config core.hooksPath scripts/git-hooks`. The broker's repository `C:\Proyectos\optaqode-frontend2.0` is read-only for this project. |
| Context route | `CONTEXT_INDEX.md` → six live feature contexts + the integration map; audit records `docs/audits/`; commands in `docs/runbooks/VERIFICATION.md`; policies in `docs/runbooks/OPERATIONS.md`; adapters in `docs/runbooks/DEPLOYMENT.md` "Orbit adapters" |

## Next valid action
Action: (Owner) push the demo tag — `git push origin v0.2.0-demo` — and rerun the CI of `aa82f75`; then, for the Agent, PH-13.2 — the panel inside the broker: a bearer identity source in the web (the host's token forwarded as `Authorization: Bearer`), the embedding kit (route entry, mount points, theme tokens, session hand-off — map §6), a smoke against a fake broker; the broker-side changes stay a proposal for the Owner's PR there.
Why now: PH-13.1 left the API connectable; the panel is the customer-facing half, and it does not need the backend answers.
Preconditions: the PH-13.1 commit green on both CI jobs once the tag is on `origin`; the Owner's confirmation that the panel ships inside the broker's app (map §6, recommendation a) rather than on its own host.
Evidence/read first: `docs/phases/PH-13.md`, `docs/integration/ORBIT-INTEGRATION.md` §2 and §6, `docs/features/FEAT-CHAT/CONTEXT.md`, `docs/features/FEAT-ORBIT/CONTEXT.md`.
If preconditions fail: CI red for the tag → push the tag and rerun (no code change); the Owner prefers a separate host → PH-13.2 designs the token hand-off first (map §7 Q1/Q14) and the web change waits.
