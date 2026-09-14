import { ATTACHMENT_LIMITS, type AllowedAttachmentMimeType } from '@orbit-support/shared';

/**
 * Detects the real type from magic bytes for the four allowed formats. The declared `Content-Type` and the
 * file extension are untrusted input (context §10.2: do not expose unsafe content to participants).
 */
export function sniffAllowedMimeType(bytes: Buffer): AllowedAttachmentMimeType | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

export function isAllowedMimeType(value: string): value is AllowedAttachmentMimeType {
  return (ATTACHMENT_LIMITS.allowedMimeTypes as readonly string[]).includes(value);
}
