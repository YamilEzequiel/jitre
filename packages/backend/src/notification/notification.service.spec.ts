import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';
import { NotificationType } from '@jitre/shared';
import { EventBusService } from '../events/event-bus.service';
import { NotificationCreatedEvent } from './events/notification-created.event';

const makeInput = (overrides = {}) => ({
  workspaceId: 'ws-1',
  recipientUserId: 'u-1',
  type: NotificationType.WORKSPACE_INVITED,
  title: 'You were invited',
  ...overrides,
});

const makeRow = (overrides: Record<string, unknown> = {}): Notification => ({
  id: 'notif-1',
  workspaceId: 'ws-1',
  recipientUserId: 'u-1',
  type: NotificationType.WORKSPACE_INVITED,
  title: 'You were invited',
  body: '',
  data: {},
  readAt: null,
  priority: 'normal',
  occurredAt: new Date('2024-01-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  createdBy: null,
  updatedBy: null,
  version: 1,
  ...overrides,
});

describe('NotificationService', () => {
  let service: NotificationService;
  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const mockEventBus = { publish: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: mockRepo },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();
    service = module.get(NotificationService);
  });

  describe('create', () => {
    it('inserts and returns a notification row', async () => {
      const row = makeRow();
      mockRepo.create.mockReturnValue(row);
      mockRepo.save.mockResolvedValue(row);

      const result = await service.create(makeInput());

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toBe(row);
    });

    it('emits NotificationCreatedEvent after successful save (H1)', async () => {
      const row = makeRow();
      mockRepo.create.mockReturnValue(row);
      mockRepo.save.mockResolvedValue(row);

      await service.create(makeInput());

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'notification.created',
          payload: expect.objectContaining({
            notificationId: 'notif-1',
            recipientUserId: 'u-1',
            type: NotificationType.WORKSPACE_INVITED,
          }),
        }),
      );
      const call = mockEventBus.publish.mock
        .calls[0][0] as NotificationCreatedEvent;
      expect(call).toBeInstanceOf(NotificationCreatedEvent);
    });
  });

  describe('listForUser', () => {
    it('returns notifications scoped to userId and workspaceId', async () => {
      mockRepo.findAndCount.mockResolvedValue([[makeRow()], 1]);

      const page = await service.listForUser('u-1', 'ws-1', {
        page: 1,
        pageSize: 10,
      });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recipientUserId: 'u-1',
            workspaceId: 'ws-1',
          }),
        }),
      );
      expect(page.total).toBe(1);
    });

    it('applies unreadOnly filter when requested', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.listForUser('u-1', 'ws-1', {
        unreadOnly: true,
        page: 1,
        pageSize: 10,
      });

      const callArg = mockRepo.findAndCount.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(callArg.where).toHaveProperty('readAt');
    });
  });

  describe('markAsRead', () => {
    it('throws ForbiddenException when userId does not match recipientUserId', async () => {
      mockRepo.findOne.mockResolvedValue(makeRow({ recipientUserId: 'u-1' }));

      await expect(service.markAsRead('notif-1', 'u-2', 'ws-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('updates readAt when currently null', async () => {
      const row = makeRow({ readAt: null, recipientUserId: 'u-1' });
      mockRepo.findOne.mockResolvedValue(row);
      mockRepo.save.mockResolvedValue({ ...row, readAt: new Date() });

      const result = await service.markAsRead('notif-1', 'u-1', 'ws-1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'notif-1', workspaceId: 'ws-1' },
      });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.readAt).not.toBeNull();
    });

    it('is idempotent: returns row unchanged if already read', async () => {
      const existingReadAt = new Date('2024-01-01');
      const row = makeRow({ readAt: existingReadAt, recipientUserId: 'u-1' });
      mockRepo.findOne.mockResolvedValue(row);

      const result = await service.markAsRead('notif-1', 'u-1', 'ws-1');

      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(result.readAt).toEqual(existingReadAt);
    });
  });

  describe('markAllAsRead', () => {
    it('returns updated count', async () => {
      mockRepo.update.mockResolvedValue({ affected: 3 });

      const result = await service.markAllAsRead('u-1', 'ws-1');

      expect(result).toEqual({ updated: 3 });
    });
  });
});
