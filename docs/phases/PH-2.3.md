# PH-2.3 — Attachments
Type: SUBPHASE TECHNICAL PLAN
Status: APPROVED
Parent: `PH-2.md`
Feature context: `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../features/FEAT-CASE/CONTEXT.md`

## Objective, prerequisites and scope
Customers and staff can attach images and PDFs to messages; files are accepted only when their bytes match an allowed type and size, they are stored behind a port, and they can be opened only by the case's participants with the right to see the message they belong to (`PROJECT_CONTEXT.md` §4.3, §10.2, §13.1 limits: PNG, JPEG, WebP, PDF; 10 MB; 3 per message). Prerequisite: PH-2.1/2.2. Out of scope: virus scanning (status `checking` reserved), object storage (PH-8), attachments on the very first message (the case must exist to receive uploads — see gaps).

## Affected boundaries and implementation approach
- Migration `0002`: `case_attachments` (case, optional message, uploader, name, MIME, size, storage key, status) with cascade/set-null FKs.
- `apps/api/src/attachments/`: `AttachmentStorage` port with `LocalDiskStorage` (`SUPPORT_UPLOADS_DIR`, default `.data/uploads`) and `MemoryStorage` (tests); `sniffAllowedMimeType` (magic bytes — declared type and extension are untrusted); `AttachmentsService.upload` (size + sniff, store, record), `linkToMessage` (same actor, same case, unattached, max 3, inside the send transaction), `forMessages`, `open` (customer: own upload or public message; staff: all; else 404).
- Endpoints on both controllers: `POST …/:id/attachments` (multipart `file`, multer memory storage with a 10 MB limit → 413) and `GET …/:id/attachments/:attachmentId` (inline, `nosniff`, `no-store`). `postMessageSchema.attachmentIds` links uploads on send; `CaseMessage.attachments` is included in details, lists and stream events.
- Web: `AttachmentComposer` (pick → upload → chips with state; client-side pre-checks; server refusals shown as "maior que 10 MB" / "tipo não permitido"), `AttachmentList` (image thumbnails fetched with identity headers via blob URLs — never a bare `<img src>`; PDF chips with "Abrir"), wired into the customer conversation and the staff case view.

## Required behavior, failures and acceptance evidence
- Type decided by bytes: an executable named `foto.png` with `image/png` is refused with 415; an oversized file with 413; a missing file with 400; more than 3 ids with 400.
- Only the uploader can link their upload; an upload cannot be linked twice; a staff upload is not downloadable by the customer until it is on a public message; another customer gets 404.
- Thumbnails and files open for both sides; unavailable files show a state, not a broken image.
Acceptance evidence: `../evidence/PH-2.3-verification.md`.

## Work performed and important decisions
DEC-0009: two-step attach (upload first, link on send) so uploads can show progress and failures independently; local-disk storage behind a port for development; MIME sniffing implemented in-house for the four allowed formats instead of a dependency. Orphaned uploads (never linked) are kept; a cleanup job is backlog (BL-009).

Known gaps: no attachments on the first message of a new case (upload needs a case id) — the customer attaches in the conversation right after; no virus scanning (`checking` status reserved); no image resizing (thumbnails use the original bytes).

## Verification, limitations and context updates
Evidence: `../evidence/PH-2.3-verification.md`. Limitations: local disk only; browser smoke uses a 1×1 PNG and a fake executable.
Context updated: `PH-2.md`, `ROADMAP.md`, `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `CONTEXT_INDEX.md`, `../features/FEAT-CASE/CONTEXT.md`, `../features/FEAT-CHAT/CONTEXT.md`, `../features/FEAT-STAFF/CONTEXT.md`, `../runbooks/VERIFICATION.md`, `../decisions/DECISION_LOG.md`, `../BACKLOG.md`.
Approved on 2026-09-13 by the Agent (evidence-based, §6.3; not a human review).
