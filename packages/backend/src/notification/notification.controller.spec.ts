import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { RequestContextService } from '../request-context/request-context.service';

const mockNotificationService = {
  listForUser: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
};

const mockRequestContext = {
  getWorkspaceId: jest.fn().mockReturnValue('ws-1'),
};

const makeReq = (userId = 'u-1') => ({ user: { id: userId } });

const makePage = (items: unknown[] = []) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
});

describe('NotificationController', () => {
  let controller: NotificationController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();
    controller = module.get(NotificationController);
  });

  describe('list', () => {
    it('returns only the current user notifications', async () => {
      const page = makePage([{ id: 'n1' }, { id: 'n2' }]);
      mockNotificationService.listForUser.mockResolvedValue(page);

      const result = await controller.list(
        { page: 1, pageSize: 20 },
        makeReq() as never,
      );

      expect(mockNotificationService.listForUser).toHaveBeenCalledWith(
        'u-1',
        'ws-1',
        expect.anything(),
      );
      expect(result).toEqual(page);
    });
  });

  describe('markAsRead', () => {
    it('calls markAsRead and returns the updated notification', async () => {
      const notif = { id: 'n1', readAt: new Date() };
      mockNotificationService.markAsRead.mockResolvedValue(notif);

      const result = await controller.markAsRead('n1', makeReq() as never);

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        'n1',
        'u-1',
        'ws-1',
      );
      expect(result).toBe(notif);
    });
  });

  describe('markAllAsRead', () => {
    it('returns { updated: number }', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue({ updated: 5 });

      const result = await controller.markAllAsRead(makeReq() as never);

      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(
        'u-1',
        'ws-1',
      );
      expect(result).toEqual({ updated: 5 });
    });
  });
});
