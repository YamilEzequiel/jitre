import { Test, TestingModule } from '@nestjs/testing';
import { ActivityTimelineService } from './activity-timeline.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '@jitre/shared';

const mockAuditService = {
  findByWorkspace: jest.fn(),
  findBySubject: jest.fn(),
};

const makeAuditRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  workspaceId: 'ws-1',
  actorUserId: 'u-1',
  action: AuditAction.WORKSPACE_MEMBER_ADDED,
  subjectType: 'WorkspaceMembership',
  subjectId: 'sub-1',
  summary: 'u-1 workspace.member.added',
  diff: {},
  occurredAt: new Date('2024-01-01'),
  ...overrides,
});

const makePage = (items: ReturnType<typeof makeAuditRow>[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 10,
});

describe('ActivityTimelineService', () => {
  let service: ActivityTimelineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityTimelineService,
        { provide: AuditLogService, useValue: mockAuditService },
      ],
    }).compile();
    service = module.get(ActivityTimelineService);
  });

  describe('list', () => {
    it('maps AuditLog rows to ActivityItem shape', async () => {
      const t2 = new Date('2024-01-02');
      const t1 = new Date('2024-01-01');
      const rows = [
        makeAuditRow({ id: 'r2', occurredAt: t2 }),
        makeAuditRow({ id: 'r1', occurredAt: t1 }),
      ];
      mockAuditService.findByWorkspace.mockResolvedValue(makePage(rows));

      const page = await service.list('ws-1', { page: 1, pageSize: 10 });

      expect(page.items).toHaveLength(2);
      expect(page.items[0]).toMatchObject({
        id: 'r2',
        action: AuditAction.WORKSPACE_MEMBER_ADDED,
        subjectType: 'WorkspaceMembership',
        occurredAt: t2,
      });
    });

    it('returns items in DESC order (delegates to AuditLogService)', async () => {
      const t3 = new Date('2024-01-03');
      mockAuditService.findByWorkspace.mockResolvedValue(
        makePage([makeAuditRow({ occurredAt: t3 })]),
      );

      const page = await service.list('ws-1', { page: 1, pageSize: 10 });

      expect(page.items[0].occurredAt).toEqual(t3);
    });
  });

  describe('listForSubject', () => {
    it('delegates to findBySubject with correct params', async () => {
      mockAuditService.findBySubject.mockResolvedValue(
        makePage([makeAuditRow()]),
      );

      await service.listForSubject('ws-1', 'User', 'sub-1', {
        page: 1,
        pageSize: 10,
      });

      expect(mockAuditService.findBySubject).toHaveBeenCalledWith(
        'ws-1',
        'User',
        'sub-1',
        { page: 1, pageSize: 10 },
      );
    });
  });
});
