import { buildStorageKey } from './path-builder.util';
import { AttachmentContext } from '@jitre/shared';

describe('buildStorageKey', () => {
  it('builds a standard path', () => {
    const result = buildStorageKey({
      workspaceId: 'W1',
      context: AttachmentContext.COMMENT,
      contextId: 'C1',
      attachmentId: 'A1',
      originalFilename: 'report.pdf',
    });
    expect(result).toBe('workspaces/W1/comment/C1/A1-report.pdf');
  });

  it('uses orphan segment when contextId is undefined', () => {
    const result = buildStorageKey({
      workspaceId: 'W1',
      context: AttachmentContext.TASK,
      attachmentId: 'A1',
      originalFilename: 'file.pdf',
    });
    expect(result).toBe('workspaces/W1/task/orphan/A1-file.pdf');
  });

  it('sanitizes filename — removes path traversal characters', () => {
    const result = buildStorageKey({
      workspaceId: 'W1',
      context: AttachmentContext.COMMENT,
      contextId: 'C1',
      attachmentId: 'A1',
      originalFilename: '../../etc/passwd',
    });
    const filename = result.split('/').pop()!;
    expect(filename).not.toContain('..');
    expect(filename).not.toContain('/');
    expect(filename).toMatch(/^A1-/);
  });

  it('sanitizes filename — replaces disallowed characters', () => {
    const result = buildStorageKey({
      workspaceId: 'W1',
      context: AttachmentContext.COMMENT,
      contextId: 'C1',
      attachmentId: 'A1',
      originalFilename: 'My File (2024).PDF',
    });
    expect(result).toBe('workspaces/W1/comment/C1/A1-my_file__2024_.pdf');
  });

  it('truncates filenames longer than 100 chars', () => {
    const longName = 'a'.repeat(200) + '.txt';
    const result = buildStorageKey({
      workspaceId: 'W1',
      context: AttachmentContext.TASK,
      contextId: 'T1',
      attachmentId: 'A1',
      originalFilename: longName,
    });
    const filename = result.split('/').pop()!;
    expect(filename.length).toBeLessThanOrEqual(4 + 100); // 'A1-' prefix + 100 chars
  });

  it('builds user_avatar path', () => {
    const result = buildStorageKey({
      workspaceId: 'W1',
      context: AttachmentContext.USER_AVATAR,
      contextId: 'U1',
      attachmentId: 'A123',
      originalFilename: 'avatar.png',
    });
    expect(result).toBe('workspaces/W1/user_avatar/U1/A123-avatar.png');
  });

  it('filename never starts with a dot', () => {
    const result = buildStorageKey({
      workspaceId: 'W1',
      context: AttachmentContext.COMMENT,
      contextId: 'C1',
      attachmentId: 'A1',
      originalFilename: '.hiddenfile',
    });
    const filename = result.split('/').pop()!;
    expect(filename).not.toMatch(/^A1-\./);
  });
});
