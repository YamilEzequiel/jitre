import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatGateway } from './chat.gateway';
import { ChatMessageCreatedEvent } from './events/chat-message-created.event';
import { ChatMessageEditedEvent } from './events/chat-message-edited.event';
import { ChatMessageDeletedEvent } from './events/chat-message-deleted.event';

@Injectable()
export class ChatListener {
  constructor(
    private readonly gateway: ChatGateway,
    private readonly logger: Logger,
  ) {}

  @OnEvent('chat.message.created')
  onMessageCreated(event: ChatMessageCreatedEvent): void {
    try {
      this.gateway.emitToChannel(
        event.payload.channelId,
        'chat:message:created',
        {
          message: {
            id: event.payload.messageId,
            channelId: event.payload.channelId,
            authorId: event.payload.authorId,
            body: event.payload.body,
            parentMessageId: event.payload.parentMessageId,
            attachments: event.payload.attachments,
            createdAt: event.payload.createdAt,
          },
        },
      );
    } catch (err: unknown) {
      this.logger.error({ event: 'chat.relay.error', name: event.name, err });
    }
  }

  @OnEvent('chat.message.edited')
  onMessageEdited(event: ChatMessageEditedEvent): void {
    try {
      this.gateway.emitToChannel(
        event.payload.channelId,
        'chat:message:edited',
        {
          message: {
            id: event.payload.messageId,
            channelId: event.payload.channelId,
            authorId: event.payload.authorId,
            body: event.payload.newBody,
            editedAt: event.payload.editedAt,
          },
        },
      );
    } catch (err: unknown) {
      this.logger.error({ event: 'chat.relay.error', name: event.name, err });
    }
  }

  @OnEvent('chat.message.deleted')
  onMessageDeleted(event: ChatMessageDeletedEvent): void {
    try {
      this.gateway.emitToChannel(
        event.payload.channelId,
        'chat:message:deleted',
        {
          messageId: event.payload.messageId,
          channelId: event.payload.channelId,
        },
      );
    } catch (err: unknown) {
      this.logger.error({ event: 'chat.relay.error', name: event.name, err });
    }
  }
}
