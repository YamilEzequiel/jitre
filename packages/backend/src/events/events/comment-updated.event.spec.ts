import { CommentUpdatedEvent } from './comment-updated.event';

describe('CommentUpdatedEvent', () => {
  it('has name "comment.updated"', () => {
    const event = new CommentUpdatedEvent({
      aggregateId: 'C1',
      aggregateType: 'Comment',
      workspaceId: 'W1',
      payload: {
        commentId: 'C1',
        previousBody: 'old',
        newBody: 'new',
        mentionedUserIds: [],
      },
    });
    expect(event.name).toBe('comment.updated');
  });
});
