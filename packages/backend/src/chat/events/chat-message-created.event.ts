import { DomainEvent } from '../../events/domain-event.base';
import type { ChatMessageAttachment } from '../chat-message.entity';

export interface ChatMessageCreatedPayload {
  messageId: string;
  channelId: string;
  authorId: string;
  body: string;
  parentMessageId: string | null;
  attachments: ChatMessageAttachment[];
  createdAt: Date;
}

export class ChatMessageCreatedEvent extends DomainEvent<ChatMessageCreatedPayload> {
  static readonly aggregateType = 'ChatMessage';

  get name(): string {
    return 'chat.message.created';
  }
}
