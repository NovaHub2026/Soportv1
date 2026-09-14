import { randomUUID } from 'node:crypto';
import { SlidingWindowLimiter } from '../common/rate-limit.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { ATTACHMENT_LIMITS, type CaseAttachment } from '@orbit-support/shared';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { type CaseAttachmentRow, caseAttachments, caseMessages, type SupportCaseRow } from '../database/schema.js';
import type { Actor } from '../identity/identity.types.js';
import { sniffAllowedMimeType } from './sniff.js';
import { ATTACHMENT_STORAGE, type AttachmentStorage } from './storage.js';

/** The subset of a multer file we rely on; kept local so the API does not depend on multer's types. */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface AttachmentContent {
  attachment: CaseAttachment;
  bytes: Buffer;
}

const SAFE_NAME = /[^\p{L}\p{N} ._()-]+/gu;

function safeFileName(name: string): string {
  const trimmed = name.replace(SAFE_NAME, '_').trim().slice(0, 150);
  return trimmed || 'arquivo';
}

/**
 * Attachments are uploaded first and linked to a message on send (PH-2.3). Authorization is always decided
 * from the database row and the case, never from the storage key (RULE-SUP-01, §10.2).
 */
@Injectable()
export class AttachmentsService {
  private readonly uploads = new SlidingWindowLimiter(ATTACHMENT_LIMITS.maxUploadsPer10Minutes, 10 * 60_000);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ATTACHMENT_STORAGE) private readonly storage: AttachmentStorage,
  ) {}

  /**
   * Validates size and real type, stores the bytes and records the attachment as unattached. A closed case takes
   * no files (its conversation is over — §7.3). Bytes are written before the row exists so a crash can never leave
   * a row whose bytes are missing (FND-0015); a failed insert removes the bytes.
   */
  async upload(actor: Actor, caseRow: SupportCaseRow, file: UploadedFileLike | undefined): Promise<CaseAttachment> {
    if (caseRow.status === 'closed') throw new ConflictException('case_closed');
    if (!file) throw new BadRequestException({ error: 'file_required' });
    if (file.size > ATTACHMENT_LIMITS.maxBytes || file.buffer.length > ATTACHMENT_LIMITS.maxBytes) {
      throw new PayloadTooLargeException({ error: 'file_too_large', maxBytes: ATTACHMENT_LIMITS.maxBytes });
    }
    const mimeType = sniffAllowedMimeType(file.buffer);
    if (!mimeType) {
      throw new UnsupportedMediaTypeException({ error: 'unsupported_file_type', allowed: ATTACHMENT_LIMITS.allowedMimeTypes });
    }
    // PH-8.1 (BL-012): one identity cannot flood the storage — 30 accepted uploads per 10 minutes. Counted only
    // after the size and type checks, so a refused file never locks the person out (Cycle Audit 3).
    this.uploads.assert(`${actor.kind}:${actor.id}`, 'too_many_uploads');
    const id = randomUUID();
    const storageKey = `${caseRow.id}/${id}`;
    await this.storage.put(storageKey, file.buffer);
    try {
      const [row] = await this.db
        .insert(caseAttachments)
        .values({
          id,
          caseId: caseRow.id,
          uploaderType: actor.kind,
          uploaderId: actor.id,
          fileName: safeFileName(file.originalname),
          mimeType,
          sizeBytes: file.buffer.length,
          storageKey,
          status: 'available',
        })
        .returning();
      return toAttachment(row);
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Links previously uploaded attachments to a message inside the caller's transaction. Every id must belong
   * to the case, be unattached and have been uploaded by the same actor; otherwise the whole send fails.
   */
  async linkToMessage(tx: Db, actor: Actor, caseId: string, messageId: string, attachmentIds: string[]): Promise<CaseAttachmentRow[]> {
    if (attachmentIds.length === 0) return [];
    if (attachmentIds.length > ATTACHMENT_LIMITS.maxPerMessage) throw new BadRequestException({ error: 'too_many_attachments' });
    const unique = [...new Set(attachmentIds)];
    const rows = await tx
      .select()
      .from(caseAttachments)
      .where(
        and(
          inArray(caseAttachments.id, unique),
          eq(caseAttachments.caseId, caseId),
          eq(caseAttachments.uploaderType, actor.kind),
          eq(caseAttachments.uploaderId, actor.id),
          isNull(caseAttachments.messageId),
        ),
      );
    if (rows.length !== unique.length) throw new BadRequestException({ error: 'attachment_not_available' });
    return tx.update(caseAttachments).set({ messageId }).where(inArray(caseAttachments.id, unique)).returning();
  }

  /** Attachments of a set of messages, grouped by message id (only messages the caller may see are passed in). */
  async forMessages(messageIds: string[]): Promise<Map<string, CaseAttachment[]>> {
    const grouped = new Map<string, CaseAttachment[]>();
    if (messageIds.length === 0) return grouped;
    const rows = await this.db
      .select()
      .from(caseAttachments)
      .where(inArray(caseAttachments.messageId, messageIds))
      .orderBy(asc(caseAttachments.createdAt));
    for (const row of rows) {
      if (!row.messageId) continue;
      const list = grouped.get(row.messageId) ?? [];
      list.push(toAttachment(row));
      grouped.set(row.messageId, list);
    }
    return grouped;
  }

  /**
   * Bytes for download. Customers may read attachments of their case that are their own uploads or linked to a
   * public message; staff may read everything on the case. Anything else is 404 (existence is not revealed).
   */
  async open(actor: Actor, caseRow: SupportCaseRow, attachmentId: string): Promise<AttachmentContent> {
    const [row] = await this.db
      .select({ attachment: caseAttachments, visibility: caseMessages.visibility })
      .from(caseAttachments)
      .leftJoin(caseMessages, eq(caseMessages.id, caseAttachments.messageId))
      .where(and(eq(caseAttachments.id, attachmentId), eq(caseAttachments.caseId, caseRow.id)))
      .limit(1);
    if (!row || row.attachment.status !== 'available') throw new NotFoundException('attachment_not_found');
    if (actor.kind === 'customer') {
      const ownUpload = row.attachment.uploaderType === 'customer' && row.attachment.uploaderId === actor.id;
      const onPublicMessage = row.visibility === 'public';
      if (!ownUpload && !onPublicMessage) throw new NotFoundException('attachment_not_found');
    }
    const bytes = await this.storage.get(row.attachment.storageKey);
    return { attachment: toAttachment(row.attachment), bytes };
  }
}

export function toAttachment(row: CaseAttachmentRow): CaseAttachment {
  return {
    id: row.id,
    caseId: row.caseId,
    messageId: row.messageId,
    uploaderType: row.uploaderType,
    uploaderId: row.uploaderId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
