# PH-9.3 — Customer panel debt
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-9.md`
Feature context: `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Pay the customer-panel debt carried since PH-2 and Cycle Audit 1: BL-010 (a customer can attach files to the very first message of a case — §4.3, §10.2) and BL-015 (FND-0024: on desktop "Fechar suporte" and "×" did nothing). Prerequisite: PH-9.2. Out of scope: attachments on the follow-up form of a closed case (it stays text-only; the follow-up keeps the previous case's files reachable), orphan cleanup of staged uploads (BL-009, PH-9.4).

## Affected boundaries and implementation approach
- Staged uploads: `POST /api/support/attachments` (customers only) stores a file with the same checks and limits as a case upload but no case (`case_attachments.case_id` nullable, migration `0020`, storage key `staged/<id>`). `CaseAttachment.caseId` is nullable in the shared contract.
- `createCaseSchema.attachmentIds`: `CasesService.createCase` links the creator's staged, unattached files to the first message inside the creation transaction (`AttachmentsService.linkStaged`, rows locked); any id that is not the creator's, already linked or unknown fails the creation as a whole (400 `attachment_not_available`), leaving no case. A retried creation (same key) returns the existing case.
- A staged file cannot be downloaded: downloads are authorized per case, and it has none until the creation links it.
- `NewRequestForm` shows the attachment composer (`customerApi.stagedAttachments`); the ready ids travel with the creation; the chips clear after success and stay after a failure.
- Desktop close (`OrbitShell`): on desktop the side panel is shown unless the customer closed it — a separate `desktopHidden` state; "×" and the topbar "Fechar suporte" hide it (the trading area takes the width, CSS `data-desktop-hidden`), the topbar then says "Suporte" and brings it back, and focus returns to that button; "Preciso de ajuda" and a notification show it again. A hidden panel marks nothing read. Mobile unchanged.

## Required behavior, failures and acceptance evidence
- Staged upload: staff 403; a disguised executable 415; a PNG 201 with `caseId: null`.
- Another customer's creation with that id → 400 and no case; the owner's creation → 201 with the file on the first message (customer and staff views), downloadable from the case; a retry returns the same case; a second case with the same id → 400.
- New-request form: the upload goes to `/api/support/attachments` with the customer's identity; the creation carries `attachmentIds`.
- Desktop: "×" hides the panel, the topbar reads "Suporte" with `aria-expanded=false` and holds focus; clicking it shows the panel; the topbar control closes it too.
Acceptance evidence: `../evidence/PH-9.3-verification.md`.

## Work performed and important decisions
As planned. DEC-0037 records staged uploads and the desktop close behavior.

## Verification, limitations and context updates
Evidence: `../evidence/PH-9.3-verification.md`. Limitations: a staged file never used stays until the orphan cleanup (BL-009, PH-9.4); jsdom has no layout, so the desktop hiding itself is observed in the browser.
Context updated: `PH-9.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`, `../runbooks/VERIFICATION.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
