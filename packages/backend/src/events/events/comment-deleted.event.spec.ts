import { CommentDeletedEvent } from './comment-deleted.event';

describe('CommentDeletedEvent', () => {
  it('has name "comment.deleted"', () => {
    const event = new CommentDeletedEvent({
      aggregateId: 'C1',
      aggregateType: 'Comment',
      workspaceId: 'W1',
      payload: { commentId: 'C1', actorUserId: 'U1' },
    });
    expect(event.name).toBe('comment.deleted');
  });
});
