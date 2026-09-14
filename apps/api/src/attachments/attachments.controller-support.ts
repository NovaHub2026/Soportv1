import { ATTACHMENT_LIMITS } from '@orbit-support/shared';
import type { Response } from 'express';
import type { AttachmentContent } from './attachments.service.js';

/**
 * multer options shared by the customer and staff upload endpoints. busboy truncates a file whose size equals
 * the limit, so the limit is one byte above the allowed maximum and the service enforces the exact boundary;
 * `defParamCharset` keeps non-ASCII file names intact (pt-BR customers). Cycle Audit 1, FND-0017.
 */
export const UPLOAD_OPTIONS = { limits: { fileSize: ATTACHMENT_LIMITS.maxBytes + 1, files: 1 }, defParamCharset: 'utf8' } as const;

/** Sends attachment bytes with safe headers: inline for images/PDF, never sniffed by the browser. */
export function sendAttachment(response: Response, content: AttachmentContent): void {
  const { attachment, bytes } = content;
  const asciiName = attachment.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  response.setHeader('Content-Type', attachment.mimeType);
  response.setHeader('Content-Length', String(bytes.length));
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader(
    'Content-Disposition',
    `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
  );
  response.end(bytes);
}
