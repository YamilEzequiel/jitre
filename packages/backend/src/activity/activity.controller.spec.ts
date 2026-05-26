import { Test, TestingModule } from '@nestjs/testing';
import { ActivityController } from './activity.controller';
import { ActivityTimelineService } from './activity-timeline.service';
import { RequestContextService } from '../request-context/request-context.service';
import { AuditAction } from '@jitre/shared';

const mockActivityService = {
  list: jest.fn(),
  listForSubject: jest.fn(),
};

const mockRequestContext = {
  getWorkspaceId: jest.fn().mockReturnValue('ws-1'),
};

const makePage = (items: unknown[] = []) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
});

const makeActivityItem = () => ({
  id: 'r1',
  action: AuditAction.WORKSPACE_MEMBER_ADDED,
  subjectType: 'WorkspaceMembership',
  subjectId: 'sub-1',
  summary: 'test',
  occurredAt: new Date(),
  diff: {},
});

describe('ActivityController', () => {
  let controller: ActivityController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityController],
      providers: [
        { provide: ActivityTimelineService, useValue: mockActivityService },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();
    controller = module.get(ActivityController);
  });

  describe('list', () => {
    it('returns activity timeline (GUEST can access — no role restriction)', async () => {
      const page = makePage([makeActivityItem()]);
      mockActivityService.list.mockResolvedValue(page);

      const result = await controller.list({ page: 1, pageSize: 20 });

      expect(mockActivityService.list).toHaveBeenCalledWith('ws-1', {
        page: 1,
        pageSize: 20,
      });
      expect(result).toEqual(page);
    });
  });

  describe('listBySubject', () => {
    it('delegates to listForSubject with correct params', async () => {
      const page = makePage([makeActivityItem()]);
      mockActivityService.listForSubject.mockResolvedValue(page);

      const result = await controller.listBySubject('User', 'sub-1', {
        page: 1,
        pageSize: 10,
      });

      expect(mockActivityService.listForSubject).toHaveBeenCalledWith(
        'ws-1',
        'User',
        'sub-1',
        { page: 1, pageSize: 10 },
      );
      expect(result).toEqual(page);
    });
  });
});
