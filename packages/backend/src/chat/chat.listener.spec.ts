import { Logger } from '@nestjs/common';
import { ChatListener } from './chat.listener';
import { ChatMessageCreatedEvent } from './events/chat-message-created.event';
import { ChatMessageEditedEvent } from './events/chat-message-edited.event';
import { ChatMessageDeletedEvent } from './events/chat-message-deleted.event';

const makeGateway = () => ({
  emitToChannel: jest.fn(),
});

describe('ChatListener', () => {
  let listener: ChatListener;
  let gateway: ReturnType<typeof makeGateway>;
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = makeGateway();
    listener = new ChatListener(gateway as never, mockLogger);
  });

  describe('onMessageCreated', () => {
    it('emits chat:message:created to the channel room', () => {
      const event = new ChatMessageCreatedEvent({
        aggregateId: 'M1',
        aggregateType: 'ChatMessage',
        workspaceId: 'W1',
        actorUserId: 'U1',
        payload: {
          messageId: 'M1',
          channelId: 'CH1',
          authorId: 'U1',
          body: 'hi',
          parentMessageId: null,
          attachments: [],
          createdAt: new Date(),
        },
      });

      listener.onMessageCreated(event);

      expect(gateway.emitToChannel).toHaveBeenCalledWith(
        'CH1',
        'chat:message:created',
        expect.objectContaining({
          message: expect.objectContaining({ id: 'M1', body: 'hi' }),
        }),
      );
    });

    it('logs and swallows errors from the gateway', () => {
      gateway.emitToChannel.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const event = new ChatMessageCreatedEvent({
        aggregateId: 'M1',
        aggregateType: 'ChatMessage',
        workspaceId: 'W1',
        payload: {
          messageId: 'M1',
          channelId: 'CH1',
          authorId: 'U1',
          body: 'hi',
          parentMessageId: null,
          attachments: [],
          createdAt: new Date(),
        },
      });
      expect(() => listener.onMessageCreated(event)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('onMessageEdited', () => {
    it('emits chat:message:edited with new body', () => {
      const event = new ChatMessageEditedEvent({
        aggregateId: 'M1',
        aggregateType: 'ChatMessage',
        workspaceId: 'W1',
        payload: {
          messageId: 'M1',
          channelId: 'CH1',
          authorId: 'U1',
          previousBody: 'old',
          newBody: 'new',
          editedAt: new Date(),
        },
      });

      listener.onMessageEdited(event);

      expect(gateway.emitToChannel).toHaveBeenCalledWith(
        'CH1',
        'chat:message:edited',
        expect.objectContaining({
          message: expect.objectContaining({ body: 'new' }),
        }),
      );
    });
  });

  describe('onMessageDeleted', () => {
    it('emits chat:message:deleted with messageId and channelId', () => {
      const event = new ChatMessageDeletedEvent({
        aggregateId: 'M1',
        aggregateType: 'ChatMessage',
        workspaceId: 'W1',
        payload: {
          messageId: 'M1',
          channelId: 'CH1',
          deletedByUserId: 'U1',
        },
      });

      listener.onMessageDeleted(event);

      expect(gateway.emitToChannel).toHaveBeenCalledWith(
        'CH1',
        'chat:message:deleted',
        { messageId: 'M1', channelId: 'CH1' },
      );
    });
  });
});
