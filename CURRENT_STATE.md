# CURRENT STATE
Type: CURRENT STATE
Synchronized on: 2026-09-13
Derived from: `docs/phases/ROADMAP.md`, `docs/phases/PH-2.md`; base checkpoint: PH-2.2 commit on `main` (child of `411f5d9`)

| Field | Value |
|---|---|
| Active objective / feature | PH-2 conversation reliability (OBJ-SUP-01, OBJ-SUP-04; FEAT-CHAT, FEAT-STAFF, FEAT-CASE). Live updates, unread/read states, connection indicator and offline recovery delivered. |
| Active phase / subphase | PH-2 `ACTIVE`. PH-2.1, PH-2.2 `APPROVED` (2026-09-13). PH-2.3 `PLANNED`, next. No subphase active. |
| Audit | Cycle 1: 1/3 first-time phase approvals (PH-1); not due; no inherited debt. |
| Blocking decisions / dependencies | None. Attachment storage port (local disk for dev) is an implementation decision recorded in PH-2.3 (decision log). |
| Integration / CI / release | Candidate: PH-2.2 commit on `main`. Local: `npm run build` exit 0, `npm run verify` exit 0, browser smoke exit 0 (`docs/evidence/PH-2.2-verification.md`). CI: PH-2.1 `411f5d9` — see its evidence; PH-2.2 commit awaiting corroboration. Release: none, not authorized. |
| Context route | `CONTEXT_INDEX.md` → `docs/features/FEAT-CHAT/CONTEXT.md`, `docs/features/FEAT-CASE/CONTEXT.md`; phase `docs/phases/PH-2.md`; commands in `docs/runbooks/VERIFICATION.md` |

## Next valid action
Action: Start PH-2.3 — attachments: `case_attachments` table (id, case, message, uploader, filename, MIME, size, storage key, status `checking | available | rejected`), a storage port with a local-disk adapter under `apps/api/.data/uploads` (gitignored), `POST …/attachments` (multipart; PNG/JPEG/WebP/PDF; 10 MB each; 3 per message — context §13.1) with MIME sniffing, protected `GET …/attachments/:id` (ownership / staff), attachments listed on messages, customer and staff UI (attach, preview, download, visible acceptance state), tests incl. negatives (wrong type, oversize, other customer). Create `docs/phases/PH-2.3.md` (pending) and set it `ACTIVE` in `docs/phases/PH-2.md`.
Why now: it is the last capability in PH-2's scope (context §4.3 "permitted attachments", §10.2 protected files) before the reliability evidence and phase approval (PH-2.4).
Preconditions: `npm run verify` passes on HEAD; tree clean or attributable; CI green on HEAD or its failure diagnosed first; ledger 1/3.
Evidence/read first: `PROJECT_CONTEXT.md` §10.2, §13.1; `docs/features/FEAT-CASE/CONTEXT.md`; `apps/api/src/database/schema.ts`; NestJS multipart handling (`@nestjs/platform-express` + `multer` types) — check what `apps/api` already has before adding dependencies.
If preconditions fail: CI red → diagnose and fix first. Unknown local changes → attribute and preserve (§4.3).
