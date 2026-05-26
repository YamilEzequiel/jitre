import { DomainEvent } from '../../events/domain-event.base';

export interface ChatMessageEditedPayload {
  messageId: string;
  channelId: string;
  authorId: string;
  previousBody: string;
  newBody: string;
  editedAt: Date;
}

export class ChatMessageEditedEvent extends DomainEvent<ChatMessageEditedPayload> {
  static readonly aggregateType = 'ChatMessage';

  get name(): string {
    return 'chat.message.edited';
  }
}
