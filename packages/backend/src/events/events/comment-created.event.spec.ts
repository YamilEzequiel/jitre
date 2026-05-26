import { CommentCreatedEvent } from './comment-created.event';

describe('CommentCreatedEvent', () => {
  it('has name "comment.created"', () => {
    const event = new CommentCreatedEvent({
      aggregateId: 'C1',
      aggregateType: 'Comment',
      workspaceId: 'W1',
      actorUserId: 'U1',
      payload: {
        commentId: 'C1',
        contextId: 'T1',
        context: 'task',
        authorUserId: 'U1',
        body: 'hello',
        mentionedUserIds: [],
      },
    });
    expect(event.name).toBe('comment.created');
  });

  it('carries the payload', () => {
    const event = new CommentCreatedEvent({
      aggregateId: 'C1',
      aggregateType: 'Comment',
      workspaceId: 'W1',
      payload: {
        commentId: 'C1',
        contextId: 'T1',
        context: 'task',
        authorUserId: 'U1',
        body: 'hello',
        mentionedUserIds: ['U2'],
      },
    });
    expect(event.payload.mentionedUserIds).toEqual(['U2']);
  });
});
