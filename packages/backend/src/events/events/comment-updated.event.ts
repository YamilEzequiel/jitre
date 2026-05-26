import { DomainEvent } from '../domain-event.base';

export interface CommentUpdatedPayload {
  commentId: string;
  previousBody: string;
  newBody: string;
  mentionedUserIds: string[];
}

export class CommentUpdatedEvent extends DomainEvent<CommentUpdatedPayload> {
  static readonly aggregateType = 'Comment';

  get name(): string {
    return 'comment.updated';
  }
}
