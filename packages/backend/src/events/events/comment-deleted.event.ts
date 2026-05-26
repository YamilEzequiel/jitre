import { DomainEvent } from '../domain-event.base';

export interface CommentDeletedPayload {
  commentId: string;
  actorUserId: string;
}

export class CommentDeletedEvent extends DomainEvent<CommentDeletedPayload> {
  static readonly aggregateType = 'Comment';

  get name(): string {
    return 'comment.deleted';
  }
}
