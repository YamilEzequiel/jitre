import { AttachmentUploadedEvent } from './attachment-uploaded.event';

describe('AttachmentUploadedEvent', () => {
  it('has name "attachment.uploaded"', () => {
    const event = new AttachmentUploadedEvent({
      aggregateId: 'A1',
      aggregateType: 'Attachment',
      workspaceId: 'W1',
      payload: {
        attachmentId: 'A1',
        storageKey: 'test/key',
        mimeType: 'image/png',
        sizeBytes: 100,
        uploaderUserId: 'U1',
        context: 'task',
      },
    });
    expect(event.name).toBe('attachment.uploaded');
  });
});
