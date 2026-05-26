/* eslint-disable @typescript-eslint/no-require-imports */

export const AVATAR_ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ATTACHMENT_ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'audio/mpeg',
] as const;

export type AvatarMime = (typeof AVATAR_ALLOWED_MIMES)[number];
export type AttachmentMime = (typeof ATTACHMENT_ALLOWED_MIMES)[number];

export interface MimeValidationResult {
  valid: boolean;
  reason?: string;
  detectedMime?: string;
}

async function detectMagicMime(buffer: Buffer): Promise<string | undefined> {
  const ft = require('file-type') as {
    fromBuffer: (buf: Buffer) => Promise<{ mime: string } | undefined>;
  };
  const result = await ft.fromBuffer(buffer);
  return result?.mime;
}

export async function validateAvatarMime(
  buffer: Buffer,
  declaredMime: string,
): Promise<MimeValidationResult> {
  if (!(AVATAR_ALLOWED_MIMES as readonly string[]).includes(declaredMime)) {
    return {
      valid: false,
      reason: `MIME type '${declaredMime}' is not allowed for avatars`,
    };
  }

  const detected = await detectMagicMime(buffer);

  if (detected && detected !== declaredMime) {
    return {
      valid: false,
      reason: `Magic bytes indicate '${detected}' but declared MIME is '${declaredMime}'`,
      detectedMime: detected,
    };
  }

  if (!detected && declaredMime !== 'image/svg+xml') {
    return {
      valid: false,
      reason: `Unable to detect MIME type from file content`,
    };
  }

  return { valid: true, detectedMime: detected };
}

export async function validateAttachmentMime(
  buffer: Buffer,
  declaredMime: string,
): Promise<MimeValidationResult> {
  if (!(ATTACHMENT_ALLOWED_MIMES as readonly string[]).includes(declaredMime)) {
    return {
      valid: false,
      reason: `MIME type '${declaredMime}' is not allowed`,
    };
  }

  const detected = await detectMagicMime(buffer);

  if (detected && detected !== declaredMime) {
    return {
      valid: false,
      reason: `Magic bytes indicate '${detected}' but declared MIME is '${declaredMime}'`,
      detectedMime: detected,
    };
  }

  if (
    !detected &&
    declaredMime.startsWith('image/') &&
    declaredMime !== 'image/svg+xml'
  ) {
    return {
      valid: false,
      reason: `Unable to detect MIME type from file content`,
    };
  }

  return { valid: true, detectedMime: detected };
}
