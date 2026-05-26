import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiUsageService } from './ai-usage.service';
import { AiUsageRecord } from './ai-usage.entity';
import { AiProvider, AiOperation } from '@jitre/shared';

const mockRepo = {
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
};

describe('AiUsageService', () => {
  let service: AiUsageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AiUsageService,
        {
          provide: getRepositoryToken(AiUsageRecord),
          useValue: mockRepo,
        },
      ],
    }).compile();
    service = module.get(AiUsageService);
  });

  describe('record()', () => {
    it('creates and saves a new AiUsageRecord', async () => {
      const input = {
        workspaceId: 'ws-1',
        userId: 'u-1',
        provider: AiProvider.GEMINI,
        model: 'gemini-2.0-flash-exp',
        operation: AiOperation.DESCRIBE,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsd: '0.000225',
        latencyMs: 800,
        success: true,
        errorCode: null,
      };

      const savedEntity = { id: 'rec-1', ...input };
      mockRepo.create.mockReturnValue(savedEntity);
      mockRepo.save.mockResolvedValue(savedEntity);

      const result = await service.record(input);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          userId: 'u-1',
          success: true,
          costUsd: '0.000225',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(savedEntity);
      expect(result.id).toBe('rec-1');
    });
  });

  describe('dailyCountForWorkspace()', () => {
    it('returns count from query', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(42),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.dailyCountForWorkspace(
        'ws-1',
        new Date('2024-01-15T00:00:00Z'),
      );
      expect(result).toBe(42);
    });

    it('query includes workspace_id condition', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.dailyCountForWorkspace('ws-2', new Date());

      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id'),
        expect.objectContaining({ workspaceId: 'ws-2' }),
      );
    });

    it('query includes deleted_at IS NULL condition', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.dailyCountForWorkspace('ws-1', new Date());

      const allCalls = [
        ...mockQb.where.mock.calls,
        ...mockQb.andWhere.mock.calls,
      ];
      const hasSoftDeleteFilter = allCalls.some(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('deleted_at') &&
          call[0].includes('NULL'),
      );
      expect(hasSoftDeleteFilter).toBe(true);
    });
  });

  describe('dailyCountForUser()', () => {
    it('returns count with userId filter', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.dailyCountForUser('ws-1', 'u-1', new Date());
      expect(result).toBe(5);
    });
  });

  describe('dailyCostForWorkspace()', () => {
    it('returns cost as string', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '1.234567' }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.dailyCostForWorkspace('ws-1', new Date());
      expect(typeof result).toBe('string');
      expect(result).toBe('1.234567');
    });

    it('returns 0.000000 when no records', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: null }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.dailyCostForWorkspace('ws-1', new Date());
      expect(result).toBe('0.000000');
    });

    it('excludes soft-deleted rows', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.dailyCostForWorkspace('ws-1', new Date());

      const allCalls = [
        ...mockQb.where.mock.calls,
        ...mockQb.andWhere.mock.calls,
      ];
      const hasSoftDeleteFilter = allCalls.some(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('deleted_at') &&
          call[0].includes('NULL'),
      );
      expect(hasSoftDeleteFilter).toBe(true);
    });
  });

  describe('usageByPeriod()', () => {
    it('returns array of usage buckets', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([
            { bucket: '2024-01-15', count: '3', totalCost: '0.001500' },
          ]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.usageByPeriod(
        'ws-1',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'day',
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
