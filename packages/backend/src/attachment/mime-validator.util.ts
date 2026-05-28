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

/**
 * File extensions that are categorically rejected regardless of declared
 * MIME or magic bytes — a sandbox would catch them later but failing
 * fast at upload time is cheaper and clearer. The list is intentionally
 * short: extensions that browsers / OS shells *execute* on download.
 */
export const ATTACHMENT_BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'cpl', 'pif',
  'ps1', 'psm1', 'sh', 'bash', 'zsh',
  'vbs', 'vbe', 'js', 'jse', 'wsh', 'wsf',
  'jar', 'app', 'dmg',
  'reg', 'inf',
  'html', 'htm', 'svg', // SVG can carry inline scripts; allow via the
  // allow-list above only if explicitly declared as image/svg+xml AND
  // sanitised downstream. For now treat the extension as risky.
] as const;

function rejectedExtension(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = filename.slice(dot + 1).toLowerCase().trim();
  if ((ATTACHMENT_BLOCKED_EXTENSIONS as readonly string[]).includes(ext)) return ext;
  return null;
}

export async function validateAttachmentMime(
  buffer: Buffer,
  declaredMime: string,
  filename?: string,
): Promise<MimeValidationResult> {
  if (filename) {
    const blocked = rejectedExtension(filename);
    if (blocked) {
      return {
        valid: false,
        reason: `File extension '.${blocked}' is blocked for security reasons`,
      };
    }
  }

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
