import { DomainEvent } from '../domain-event.base';

export interface MentionCreatedPayload {
  mentionedUserId: string;
  sourceType: string;
  sourceId: string;
  excerpt: string;
}

export class MentionCreatedEvent extends DomainEvent<MentionCreatedPayload> {
  static readonly aggregateType = 'Mention';

  get name(): string {
    return 'mention.created';
  }
}
