import { BadRequestException } from '@nestjs/common';
import { AiAnalyticsService } from './ai-analytics.service';

const makeAiUsageQuery = () => ({ execute: jest.fn().mockResolvedValue([]) });
const makeByUserQuery = () => ({ execute: jest.fn().mockResolvedValue([]) });
const makeByOpQuery = () => ({ execute: jest.fn().mockResolvedValue([]) });
const makeFailureRateQuery = () => ({
  execute: jest.fn().mockResolvedValue([]),
});
const makeRequestContext = (workspaceId = 'ws-1') => ({
  getWorkspaceId: jest.fn().mockReturnValue(workspaceId),
  getUserId: jest.fn().mockReturnValue('user-1'),
  getRole: jest.fn().mockReturnValue(null),
});

describe('AiAnalyticsService', () => {
  let service: AiAnalyticsService;
  let aiUsageQuery: ReturnType<typeof makeAiUsageQuery>;
  let requestContext: ReturnType<typeof makeRequestContext>;

  beforeEach(() => {
    aiUsageQuery = makeAiUsageQuery();
    requestContext = makeRequestContext();
    service = new AiAnalyticsService(
      aiUsageQuery as never,
      makeByUserQuery() as never,
      makeByOpQuery() as never,
      makeFailureRateQuery() as never,
      requestContext as never,
    );
  });

  describe('aiUsage()', () => {
    it('validates date range before query', async () => {
      await expect(
        service.aiUsage({
          period: 'day',
          from: '2026-05-31',
          to: '2026-05-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(aiUsageQuery.execute).not.toHaveBeenCalled();
    });

    it('calls aiUsageQuery.execute with correct params', async () => {
      await service.aiUsage({
        period: 'day',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(aiUsageQuery.execute).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1', period: 'day' }),
      );
    });

    it('throws RANGE_TOO_LARGE for 366+ day range', async () => {
      await expect(
        service.aiUsage({
          period: 'day',
          from: '2025-01-01',
          to: '2026-01-02',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('aiUsageByUser()', () => {
    it('validates date range', async () => {
      const byUserQuery = makeByUserQuery();
      const svc = new AiAnalyticsService(
        makeAiUsageQuery() as never,
        byUserQuery as never,
        makeByOpQuery() as never,
        makeFailureRateQuery() as never,
        requestContext as never,
      );
      await expect(
        svc.aiUsageByUser({ from: '2026-05-31', to: '2026-05-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(byUserQuery.execute).not.toHaveBeenCalled();
    });
  });

  describe('aiUsageByOperation()', () => {
    it('validates date range', async () => {
      await expect(
        service.aiUsageByOperation({ from: '2026-05-31', to: '2026-05-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('aiUsageFailureRate()', () => {
    it('validates date range', async () => {
      await expect(
        service.aiUsageFailureRate({
          period: 'day',
          from: '2026-05-31',
          to: '2026-05-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
