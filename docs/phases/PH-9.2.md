# PH-9.2 — Staff workspace debt
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-9.md`
Feature context: `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Pay the web-side debt carried by the audits: BL-014 (Cycle Audit 1 FND-0024 — one action path, `StaffCaseView.tsx` split, tests for the workspace picker and hidden-tab marking), the web half of BL-013 (note retry key, attachments of pending rows) and the BL-024 items still open (Cycle Audit 2 FND-0041/FND-0056 — queue tab semantics, number fields kept as typed, system-message copy through the dictionary). Prerequisite: PH-9.1 (the note key exists in the API). Out of scope: attachments on the first message of a case and the desktop close controls (PH-9.3).

## Affected boundaries and implementation approach
- `StaffCaseView.tsx` (852 → about 300 lines) keeps loading, polling and read-marking; every case action goes through one `runAction(work, failure, setState)` (busy → call → re-read → notify; the failure message, and `true` so a form closes only after a success). Split out: `CaseActions.tsx` (state actions and the transfer, consultation and resolution forms), `StaffComposer.tsx` (reply/note composer), `StaffMessage.tsx`, `CaseContext.tsx` (context column, consultation cards, history wording).
- `StaffComposer` keeps one retry key per mode (reply, note) until that send succeeds: a retried note is stored once (PH-9.1 API), a failure keeps the text and the attachment chips.
- Customer pending rows (`CaseConversation.tsx`): a pending or failed message lists the names of the files it carries ("Anexos: …"), kept with the row in `sessionStorage`; `AttachmentComposer.onReadyChange` also reports the ready uploads.
- System messages: `case_messages.system_kind` / `system_data` (migration `0019`); the API writes `follow_up_of { reference }` and `outside_hours { weekday, open }` next to the pt-BR `body`; `CaseMessage.systemKind/systemData` in the shared contract; `apps/web/src/lib/system-messages.ts` words them from the dictionary (`systemMessages`, the home's `nextOpening` and weekdays) on both surfaces, and shows `body` for messages without a kind (older rows).
- Queue tabs (`StaffQueue.tsx`): `tablist` with a label, one tab stop (roving `tabIndex`), ArrowLeft/ArrowRight/Home/End change the view and move focus, `aria-controls` → the list is the `tabpanel` labelled by the selected tab.
- Settings form (`SupervisionPanel.tsx`): the four number fields keep the typed text; submit refuses an empty or non-integer field by its label without sending (ranges stay the API's 400 with field names).

## Required behavior, failures and acceptance evidence
- A failed note keeps its text; the retry sends the same key; the next note a new key. The existing note/consultation test sends the key.
- A failed customer message shows "Anexos: comprovante.png"; the retry sends the same body, key and attachment ids; the row disappears on success.
- A system message with a kind is worded by the dictionary (the stored body is not shown); one without a kind shows its body; the API records `outside_hours` with no next opening as `{}` and a follow-up's reference.
- Tabs: one tab stop, keyboard navigation with wrap-around, focus follows, panel labelled by the selected tab.
- An emptied threshold is refused by name and nothing is sent; "12" is sent as 12 and stays "12".
- The workspace picker switches the identity headers and the supervision entry follows the role; a hidden browser tab marks nothing read.
Acceptance evidence: `../evidence/PH-9.2-verification.md`.

## Work performed and important decisions
As planned. DEC-0036 records the system-message kinds, the per-mode retry keys and the client-side number check.

## Verification, limitations and context updates
Evidence: `../evidence/PH-9.2-verification.md`. Limitations: the API still writes the pt-BR body (the record of what was shown); e-mail subjects remain API copy (server-side, pt-BR only until a second locale exists).
Context updated: `PH-9.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`, `../../CONTEXT_INDEX.md`.
Approved on 2026-09-14 by the Agent (evidence-based, §6.3; not a human review).
