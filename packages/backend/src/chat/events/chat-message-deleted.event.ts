import { DomainEvent } from '../../events/domain-event.base';

export interface ChatMessageDeletedPayload {
  messageId: string;
  channelId: string;
  deletedByUserId: string;
}

export class ChatMessageDeletedEvent extends DomainEvent<ChatMessageDeletedPayload> {
  static readonly aggregateType = 'ChatMessage';

  get name(): string {
    return 'chat.message.deleted';
  }
}
