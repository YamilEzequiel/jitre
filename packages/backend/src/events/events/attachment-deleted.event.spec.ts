import { AttachmentDeletedEvent } from './attachment-deleted.event';

describe('AttachmentDeletedEvent', () => {
  it('has name "attachment.deleted"', () => {
    const event = new AttachmentDeletedEvent({
      aggregateId: 'A1',
      aggregateType: 'Attachment',
      workspaceId: 'W1',
      payload: {
        attachmentId: 'A1',
        actorUserId: 'U1',
        storageKey: 'test/key',
      },
    });
    expect(event.name).toBe('attachment.deleted');
  });
});
