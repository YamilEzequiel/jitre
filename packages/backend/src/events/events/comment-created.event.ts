import { DomainEvent } from '../domain-event.base';

export interface CommentCreatedPayload {
  commentId: string;
  contextId: string;
  context: string;
  authorUserId: string;
  body: string;
  mentionedUserIds: string[];
  parentId?: string;
}

export class CommentCreatedEvent extends DomainEvent<CommentCreatedPayload> {
  static readonly aggregateType = 'Comment';

  get name(): string {
    return 'comment.created';
  }
}
