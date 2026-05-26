import { BadRequestException } from '@nestjs/common';
import { WorkspaceRole } from '@jitre/shared';
import { DomainAnalyticsService } from './domain-analytics.service';

const makeVelocityQuery = () => ({
  execute: jest.fn().mockResolvedValue([{ period: '2026-W19', value: 3 }]),
});
const makeThroughputQuery = () => ({
  execute: jest.fn().mockResolvedValue([]),
});
const makeLeadTimeQuery = () => ({ execute: jest.fn().mockResolvedValue([]) });
const makeCycleTimeQuery = () => ({ execute: jest.fn().mockResolvedValue([]) });
const makeWorkloadQuery = () => ({ execute: jest.fn().mockResolvedValue([]) });
const makeBurndownQuery = () => ({ execute: jest.fn().mockResolvedValue([]) });
const makeStatusFlowQuery = () => ({
  executeWithMeta: jest
    .fn()
    .mockResolvedValue({ edges: [], isLimitHit: false }),
});
const makeMembershipService = (projectIds: string[] = ['p-1', 'p-2']) => ({
  findProjectIdsForUser: jest.fn().mockResolvedValue(projectIds),
});

const makeRequestContext = (
  workspaceId = 'ws-1',
  userId = 'user-1',
  role: WorkspaceRole = WorkspaceRole.MEMBER,
) => ({
  getWorkspaceId: jest.fn().mockReturnValue(workspaceId),
  getUserId: jest.fn().mockReturnValue(userId),
  getRole: jest.fn().mockReturnValue(role),
});

describe('DomainAnalyticsService', () => {
  let service: DomainAnalyticsService;
  let velocityQuery: ReturnType<typeof makeVelocityQuery>;
  let membershipService: ReturnType<typeof makeMembershipService>;
  let requestContext: ReturnType<typeof makeRequestContext>;

  beforeEach(() => {
    velocityQuery = makeVelocityQuery();
    membershipService = makeMembershipService();
    requestContext = makeRequestContext();
    service = new DomainAnalyticsService(
      velocityQuery as never,
      makeThroughputQuery() as never,
      makeLeadTimeQuery() as never,
      makeCycleTimeQuery() as never,
      makeWorkloadQuery() as never,
      makeBurndownQuery() as never,
      makeStatusFlowQuery() as never,
      membershipService as never,
      requestContext as never,
    );
  });

  describe('velocity()', () => {
    it('calls DateRangeHelper.validate before executing query', async () => {
      await expect(
        service.velocity({
          scope: 'workspace',
          period: 'week',
          from: '2026-05-01',
          to: '2023-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(velocityQuery.execute).not.toHaveBeenCalled();
    });

    it('returns result from velocity query', async () => {
      const result = await service.velocity({
        scope: 'workspace',
        period: 'week',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(velocityQuery.execute).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('applies membership filter for workspace-scope (non-admin)', async () => {
      await service.velocity({
        scope: 'workspace',
        period: 'week',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(membershipService.findProjectIdsForUser).toHaveBeenCalledWith(
        'ws-1',
        'user-1',
      );
    });

    it('bypasses membership filter for ADMIN role', async () => {
      const adminContext = makeRequestContext(
        'ws-1',
        'admin-1',
        WorkspaceRole.ADMIN,
      );
      const adminService = new DomainAnalyticsService(
        velocityQuery as never,
        makeThroughputQuery() as never,
        makeLeadTimeQuery() as never,
        makeCycleTimeQuery() as never,
        makeWorkloadQuery() as never,
        makeBurndownQuery() as never,
        makeStatusFlowQuery() as never,
        membershipService as never,
        adminContext as never,
      );
      await adminService.velocity({
        scope: 'workspace',
        period: 'week',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(membershipService.findProjectIdsForUser).not.toHaveBeenCalled();
    });

    it('bypasses membership filter for OWNER role', async () => {
      const ownerContext = makeRequestContext(
        'ws-1',
        'owner-1',
        WorkspaceRole.OWNER,
      );
      const ownerService = new DomainAnalyticsService(
        velocityQuery as never,
        makeThroughputQuery() as never,
        makeLeadTimeQuery() as never,
        makeCycleTimeQuery() as never,
        makeWorkloadQuery() as never,
        makeBurndownQuery() as never,
        makeStatusFlowQuery() as never,
        membershipService as never,
        ownerContext as never,
      );
      await ownerService.velocity({
        scope: 'workspace',
        period: 'week',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(membershipService.findProjectIdsForUser).not.toHaveBeenCalled();
    });

    it('throws RANGE_TOO_LARGE for 366+ day range', async () => {
      await expect(
        service.velocity({
          scope: 'workspace',
          period: 'day',
          from: '2025-01-01',
          to: '2026-01-02',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('throughput()', () => {
    it('validates range before query', async () => {
      const throughputQuery = makeThroughputQuery();
      const svc = new DomainAnalyticsService(
        makeVelocityQuery() as never,
        throughputQuery as never,
        makeLeadTimeQuery() as never,
        makeCycleTimeQuery() as never,
        makeWorkloadQuery() as never,
        makeBurndownQuery() as never,
        makeStatusFlowQuery() as never,
        membershipService as never,
        requestContext as never,
      );
      await expect(
        svc.throughput({
          scope: 'workspace',
          period: 'week',
          from: '2026-05-10',
          to: '2026-05-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(throughputQuery.execute).not.toHaveBeenCalled();
    });
  });

  describe('workload()', () => {
    it('does not validate date range (point-in-time endpoint)', async () => {
      const result = await service.workload({ groupBy: 'assignee' });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('statusFlow()', () => {
    it('returns edges and isLimitHit flag', async () => {
      const { edges, isLimitHit } = await service.statusFlow({
        projectId: 'p-1',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(Array.isArray(edges)).toBe(true);
      expect(typeof isLimitHit).toBe('boolean');
    });
  });
});
