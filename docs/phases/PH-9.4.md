# PH-9.4 — Operations and process debt; phase closure
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-9.md`
Feature context: `../features/FEAT-ACCESS/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Pay the last Agent-owned debt of the carried backlog and close PH-9: BL-026 (cycle 3 FND-0070 — `Retry-After` on every 429 and a proxy-aware per-client limit for the recovery route; blocking any deployment beyond loopback), BL-009 (uploads never linked to a message, now including staged uploads — DEC-0037), BL-023 (Cycle Audit 2 FND-0053 — the smoke's ordering-dependent references) and BL-030 (FND-0080 — checker blind spots). Prerequisite: PH-9.3. Out of scope: a shared rate-limit store (one instance — DEC-0033), scanning non-Markdown sources for paths, CI run ids (network).

## Affected boundaries and implementation approach
- `RetryAfterFilter` (global): a 429 gets `Retry-After` from the body's `retryAfterSeconds`, or 5 s when the refusal has none (the stream cap).
- Recovery route: `ACCESS_RECOVERY_LIMITS.perClientPer10Minutes` (10) on the client address Express reports under `trust proxy` = `SUPPORT_TRUST_PROXY`, the number of reverse proxies that append `X-Forwarded-For` in front of the web — unset by default, and then the limit is off. The first design trusted one hop (the web) by default; a probe through the built web showed that Next's rewrite proxy does not add the browser's address and passes a forged header through, which would have turned the limit into one shared bucket for everybody and let a forged header escape it. 429 `too_many_from_client` has its own honest copy ("desta conexão"); a retry of an accepted request is answered before the limit.
- `AttachmentCleanupJob` (hourly) → `AttachmentsService.removeUnlinked(now, graceHours)`: rows unlinked for more than `SUPPORT_UNLINKED_ATTACHMENT_GRACE_HOURS` (24) are deleted only while still unlinked, then their bytes. Linking now checks the update count, so a file removed meanwhile fails the send instead of silently missing from it.
- Smoke: `shownReference(page, known)` reads each new case reference from the conversation header; no reference is hard-coded.
- `check-context`: path-like words inside command spans are checked like single-path spans (from the root, the document and each workspace); commit hashes and release tags quoted in live documents must exist (the CI `verify` job checks out full history); the ledger's record cell is read as its first `.md` path, and an out-of-band record does not discharge a due cycle.
- Phase closure: `npm run verify` through the gate plus `npm run build` (the `full` profile), `npm run test:pg -w api` on PostgreSQL 16, the full smoke with its screenshots kept (phase candidate — DEC-0034 c), the phase approval record and the cycle 3 ledger.

## Required behavior, failures and acceptance evidence
- Behind an appending proxy (`SUPPORT_TRUST_PROXY=1`): the 11th recovery request from one client address in 10 minutes → 429 `too_many_from_client` with `Retry-After` equal to the body's hint; another address is unaffected; a forged `X-Forwarded-For` does not escape; a retried accepted request is answered. Without it: no per-client refusal. The per-contact 429 carries `Retry-After` too.
- After the grace period an abandoned case upload and a staged upload are removed with their bytes; a linked and a recent upload stay; a second run removes nothing.
- The cleanup job's `tick()` behaves like the other jobs (single flight, logged failure, interval, switch).
- The checker fails on a missing path inside a command, an unknown commit, an unknown tag and an out-of-band record for a due cycle (demonstrated in disposable worktrees).
Acceptance evidence: `../evidence/PH-9.4-verification.md`; phase: `../evidence/PH-9-phase-approval.md`.

## Work performed and important decisions
As planned. DEC-0038 records the retry header, the per-client limit and its trust-proxy setting, the cleanup, the smoke references and the checker rules.

## Verification, limitations and context updates
Evidence: `../evidence/PH-9.4-verification.md`. Limitations: limits stay per instance (DEC-0033); in the loopback/compose topology the per-client limit is off (no address identifies a client there); a direct caller of the API could name its own address when a proxy count is set, but no supported topology exposes the API (DEC-0031, DEC-0034); the checker still does not read `.sh`/`.sql`/Dockerfiles/`.env.example` or CI run ids (BL-030, carried part).
Context updated: `PH-9.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-ACCESS/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`, `../runbooks/VERIFICATION.md`, `../runbooks/DEPLOYMENT.md`, `../../CONTEXT_INDEX.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
