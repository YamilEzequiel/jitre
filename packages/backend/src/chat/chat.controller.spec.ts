import { Test } from '@nestjs/testing';
import { WorkspaceRole } from '@jitre/shared';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

const mockService = {
  createChannel: jest.fn(),
  createOrGetDm: jest.fn(),
  listChannels: jest.fn(),
  getChannel: jest.fn(),
  getProjectChannel: jest.fn(),
  updateChannel: jest.fn(),
  deleteChannel: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
  listMessages: jest.fn(),
  sendMessage: jest.fn(),
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
  markAsRead: jest.fn(),
  getUnreadCount: jest.fn(),
  searchMessages: jest.fn(),
};

function makeReq(overrides: Record<string, unknown> = {}): unknown {
  return {
    user: { id: 'U1' },
    workspace: { id: 'W1', role: WorkspaceRole.MEMBER },
    ...overrides,
  };
}

describe('ChatController', () => {
  let controller: ChatController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: mockService }],
    }).compile();
    controller = module.get(ChatController);
  });

  describe('listChannels() — GET /chat/channels', () => {
    it('delegates to service with workspaceId + userId', async () => {
      mockService.listChannels.mockResolvedValueOnce([{ id: 'CH1' }]);
      const result = await controller.listChannels(
        makeReq() as Parameters<typeof controller.listChannels>[0],
      );
      expect(mockService.listChannels).toHaveBeenCalledWith('W1', 'U1');
      expect(result).toEqual([{ id: 'CH1' }]);
    });
  });

  describe('createChannel() — POST /chat/channels', () => {
    it('passes dto through to service.createChannel', async () => {
      mockService.createChannel.mockResolvedValueOnce({ id: 'CH1' });
      const dto = {
        name: 'random',
        type: 'public' as const,
        memberUserIds: ['U2'],
      };
      const result = await controller.createChannel(
        dto,
        makeReq() as Parameters<typeof controller.createChannel>[1],
      );
      expect(mockService.createChannel).toHaveBeenCalledWith('W1', 'U1', dto);
      expect(result).toEqual({ id: 'CH1' });
    });
  });

  describe('createOrGetDm() — POST /chat/dm', () => {
    it('delegates to service.createOrGetDm', async () => {
      mockService.createOrGetDm.mockResolvedValueOnce({ id: 'DM1' });
      const result = await controller.createOrGetDm(
        { otherUserId: 'U9' },
        makeReq() as Parameters<typeof controller.createOrGetDm>[1],
      );
      expect(mockService.createOrGetDm).toHaveBeenCalledWith('W1', 'U1', 'U9');
      expect(result).toEqual({ id: 'DM1' });
    });
  });

  describe('getChannel() — GET /chat/channels/:id', () => {
    it('delegates to service.getChannel', async () => {
      mockService.getChannel.mockResolvedValueOnce({ id: 'CH1' });
      const result = await controller.getChannel(
        'CH1',
        makeReq() as Parameters<typeof controller.getChannel>[1],
      );
      expect(mockService.getChannel).toHaveBeenCalledWith('CH1', 'W1');
      expect(result).toEqual({ id: 'CH1' });
    });
  });

  describe('getProjectChannel() — GET /chat/projects/:projectId/channel', () => {
    it('delegates to service.getProjectChannel', async () => {
      mockService.getProjectChannel.mockResolvedValueOnce({ id: 'CH-PROJ', projectId: 'P1' });
      const result = await controller.getProjectChannel(
        'P1',
        makeReq() as Parameters<typeof controller.getProjectChannel>[1],
      );
      expect(mockService.getProjectChannel).toHaveBeenCalledWith('P1', 'W1');
      expect(result).toEqual({ id: 'CH-PROJ', projectId: 'P1' });
    });
  });

  describe('updateChannel() — PATCH /chat/channels/:id', () => {
    it('delegates to service.updateChannel', async () => {
      mockService.updateChannel.mockResolvedValueOnce({ id: 'CH1' });
      await controller.updateChannel(
        'CH1',
        { name: 'renamed' },
        makeReq() as Parameters<typeof controller.updateChannel>[2],
      );
      expect(mockService.updateChannel).toHaveBeenCalledWith('CH1', 'W1', {
        name: 'renamed',
      });
    });
  });

  describe('deleteChannel() — DELETE /chat/channels/:id', () => {
    it('delegates to service.deleteChannel', async () => {
      mockService.deleteChannel.mockResolvedValueOnce(undefined);
      await controller.deleteChannel(
        'CH1',
        makeReq() as Parameters<typeof controller.deleteChannel>[1],
      );
      expect(mockService.deleteChannel).toHaveBeenCalledWith('CH1', 'W1');
    });
  });

  describe('addMember() — POST /chat/channels/:id/members', () => {
    it('delegates to service.addMember', async () => {
      mockService.addMember.mockResolvedValueOnce({});
      await controller.addMember(
        'CH1',
        { userId: 'U9' },
        makeReq() as Parameters<typeof controller.addMember>[2],
      );
      expect(mockService.addMember).toHaveBeenCalledWith('CH1', 'W1', 'U9');
    });
  });

  describe('removeMember() — DELETE /chat/channels/:id/members/:userId', () => {
    it('delegates to service.removeMember', async () => {
      mockService.removeMember.mockResolvedValueOnce(undefined);
      await controller.removeMember(
        'CH1',
        'U9',
        makeReq() as Parameters<typeof controller.removeMember>[2],
      );
      expect(mockService.removeMember).toHaveBeenCalledWith('CH1', 'W1', 'U9');
    });
  });

  describe('listMessages() — GET /chat/channels/:id/messages', () => {
    it('delegates to service.listMessages with query dto', async () => {
      mockService.listMessages.mockResolvedValueOnce({
        data: [],
        hasMore: false,
        nextCursor: null,
      });
      await controller.listMessages(
        'CH1',
        { before: 'M1', limit: 25 },
        makeReq() as Parameters<typeof controller.listMessages>[2],
      );
      expect(mockService.listMessages).toHaveBeenCalledWith('CH1', 'W1', {
        before: 'M1',
        limit: 25,
      });
    });
  });

  describe('sendMessage() — POST /chat/messages', () => {
    it('delegates to service.sendMessage', async () => {
      mockService.sendMessage.mockResolvedValueOnce({ id: 'M1' });
      const dto = { channelId: 'CH1', body: 'hello' };
      const result = await controller.sendMessage(
        dto,
        makeReq() as Parameters<typeof controller.sendMessage>[1],
      );
      expect(mockService.sendMessage).toHaveBeenCalledWith('W1', 'U1', dto);
      expect(result).toEqual({ id: 'M1' });
    });
  });

  describe('editMessage() — PATCH /chat/messages/:id', () => {
    it('delegates to service.editMessage', async () => {
      mockService.editMessage.mockResolvedValueOnce({ id: 'M1', body: 'new' });
      await controller.editMessage(
        'M1',
        { body: 'new' },
        makeReq() as Parameters<typeof controller.editMessage>[2],
      );
      expect(mockService.editMessage).toHaveBeenCalledWith('M1', 'W1', 'U1', {
        body: 'new',
      });
    });
  });

  describe('deleteMessage() — DELETE /chat/messages/:id', () => {
    it('delegates to service.deleteMessage with role', async () => {
      mockService.deleteMessage.mockResolvedValueOnce(undefined);
      await controller.deleteMessage(
        'M1',
        makeReq() as Parameters<typeof controller.deleteMessage>[1],
      );
      expect(mockService.deleteMessage).toHaveBeenCalledWith(
        'M1',
        'W1',
        'U1',
        WorkspaceRole.MEMBER,
      );
    });
  });

  describe('markAsRead() — POST /chat/channels/:id/read', () => {
    it('delegates to service.markAsRead', async () => {
      mockService.markAsRead.mockResolvedValueOnce({ lastReadMessageId: 'M1' });
      await controller.markAsRead(
        'CH1',
        { messageId: 'M1' },
        makeReq() as Parameters<typeof controller.markAsRead>[2],
      );
      expect(mockService.markAsRead).toHaveBeenCalledWith(
        'CH1',
        'W1',
        'U1',
        'M1',
      );
    });
  });

  describe('getUnreadCount() — GET /chat/channels/:id/unread-count', () => {
    it('wraps the service number in { count }', async () => {
      mockService.getUnreadCount.mockResolvedValueOnce(4);
      const result = await controller.getUnreadCount(
        'CH1',
        makeReq() as Parameters<typeof controller.getUnreadCount>[1],
      );
      expect(result).toEqual({ count: 4 });
    });
  });

  describe('searchMessages() — GET /chat/search', () => {
    it('delegates to service.searchMessages', async () => {
      mockService.searchMessages.mockResolvedValueOnce([{ id: 'M1' }]);
      await controller.searchMessages(
        { q: 'hi', limit: 10 },
        makeReq() as Parameters<typeof controller.searchMessages>[1],
      );
      expect(mockService.searchMessages).toHaveBeenCalledWith(
        'W1',
        'U1',
        'hi',
        10,
      );
    });
  });
});
