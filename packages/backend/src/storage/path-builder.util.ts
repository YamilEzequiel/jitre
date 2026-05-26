import { AttachmentContext } from '@jitre/shared';

export interface BuildPathInput {
  workspaceId: string;
  context: AttachmentContext;
  contextId?: string;
  attachmentId: string;
  originalFilename: string;
}

function sanitizeFilename(name: string): string {
  let safe = name
    .toLowerCase()
    .replace(/\.\./g, '_')
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/^\.+/, '_');

  if (safe.length > 100) {
    safe = safe.slice(0, 100);
  }

  return safe;
}

export function buildStorageKey(input: BuildPathInput): string {
  const { workspaceId, context, contextId, attachmentId, originalFilename } =
    input;

  const segment = contextId ?? 'orphan';
  const safeFilename = sanitizeFilename(originalFilename);

  return `workspaces/${workspaceId}/${context}/${segment}/${attachmentId}-${safeFilename}`;
}
