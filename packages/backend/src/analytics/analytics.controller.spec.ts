import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AnalyticsController } from './analytics.controller';
import { DomainAnalyticsService } from './domain-analytics.service';
import { AiAnalyticsService } from './ai-analytics.service';
import { AbilityGuard } from '../auth/guards/ability.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { REQUIRE_ABILITY_KEY } from '../auth/decorators/require-ability.decorator';

const makeDomainService = () => ({
  velocity: jest.fn().mockResolvedValue([{ period: '2026-W19', value: 3 }]),
  throughput: jest.fn().mockResolvedValue([]),
  workload: jest.fn().mockResolvedValue([]),
});

const makeAiService = () => ({
  aiUsage: jest.fn().mockResolvedValue([]),
  aiUsageByUser: jest.fn().mockResolvedValue([]),
  aiUsageByOperation: jest.fn().mockResolvedValue([]),
  aiUsageFailureRate: jest.fn().mockResolvedValue([]),
});

/** Helper: extract the RequireAbility fn from a handler method */
function getAbilityFn(
  handler: object,
): ((ability: unknown) => boolean) | undefined {
  return Reflect.getMetadata(REQUIRE_ABILITY_KEY, handler) as
    | ((ability: unknown) => boolean)
    | undefined;
}

// Pass-through guard for controller unit tests (guards are tested separately)
const passGuard = { canActivate: () => true };

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let domainService: ReturnType<typeof makeDomainService>;
  let aiService: ReturnType<typeof makeAiService>;

  beforeEach(async () => {
    domainService = makeDomainService();
    aiService = makeAiService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: DomainAnalyticsService, useValue: domainService },
        { provide: AiAnalyticsService, useValue: aiService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(passGuard)
      .overrideGuard(AbilityGuard)
      .useValue(passGuard)
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  describe('workspaceVelocity()', () => {
    it('returns velocity time series', async () => {
      const result = await controller.workspaceVelocity({
        period: 'week',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(domainService.velocity).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('propagates BadRequestException from service', async () => {
      domainService.velocity.mockRejectedValueOnce(
        new BadRequestException({ code: 'RANGE_TOO_LARGE', maxDays: 365 }),
      );
      await expect(
        controller.workspaceVelocity({
          period: 'week',
          from: '2025-01-01',
          to: '2026-01-02',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('has @RequireAbility for read_workspace_analytics on velocity handler', () => {
      const fn = getAbilityFn(controller.workspaceVelocity);
      expect(fn).toBeDefined();
      const allowedAbility = { can: jest.fn().mockReturnValue(true) };
      const deniedAbility = { can: jest.fn().mockReturnValue(false) };
      expect(fn!(allowedAbility)).toBe(true);
      expect(fn!(deniedAbility)).toBe(false);
    });
  });

  describe('workspaceThroughput()', () => {
    it('calls throughput service', async () => {
      await controller.workspaceThroughput({
        period: 'week',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(domainService.throughput).toHaveBeenCalled();
    });

    it('has @RequireAbility for read_workspace_analytics on throughput handler', () => {
      const fn = getAbilityFn(controller.workspaceThroughput);
      expect(fn).toBeDefined();
      const allowedAbility = { can: jest.fn().mockReturnValue(true) };
      expect(fn!(allowedAbility)).toBe(true);
    });
  });

  describe('workspaceWorkload()', () => {
    it('calls workload service', async () => {
      await controller.workspaceWorkload({ groupBy: 'assignee' });
      expect(domainService.workload).toHaveBeenCalled();
    });

    it('has @RequireAbility for read_workspace_analytics on workload handler', () => {
      const fn = getAbilityFn(controller.workspaceWorkload);
      expect(fn).toBeDefined();
    });
  });

  describe('AbilityGuard integration (unit)', () => {
    it('AbilityGuard throws ForbiddenException when ability is denied', async () => {
      const mockRcService = { getAbility: jest.fn().mockReturnValue(null) };
      const reflector = new Reflector();
      const guard = new AbilityGuard(reflector, mockRcService as never);

      // Simulate a handler that has a RequireAbility fn
      const handler: Record<string, unknown> = {};
      Reflect.defineMetadata(
        REQUIRE_ABILITY_KEY,
        (ability: { can: () => boolean }) => ability.can(),
        handler,
      );
      const ctx = {
        getHandler: () => handler,
        getClass: () => ({}),
      } as never;

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('workspaceAiUsage()', () => {
    it('calls aiUsage service', async () => {
      await controller.workspaceAiUsage({
        period: 'day',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(aiService.aiUsage).toHaveBeenCalled();
    });

    it('has @RequireAbility for read_workspace_analytics on ai-usage handler', () => {
      const fn = getAbilityFn(controller.workspaceAiUsage);
      expect(fn).toBeDefined();
    });
  });

  describe('workspaceAiUsageByUser()', () => {
    it('calls aiUsageByUser service', async () => {
      await controller.workspaceAiUsageByUser({
        period: 'day',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(aiService.aiUsageByUser).toHaveBeenCalled();
    });

    it('has @RequireAbility for read_ai_analytics_by_user on by-user handler', () => {
      const fn = getAbilityFn(controller.workspaceAiUsageByUser);
      expect(fn).toBeDefined();
      // The ability fn should require read_ai_analytics_by_user specifically
      const allowedAbility = { can: jest.fn().mockReturnValue(true) };
      const deniedAbility = { can: jest.fn().mockReturnValue(false) };
      expect(fn!(allowedAbility)).toBe(true);
      expect(fn!(deniedAbility)).toBe(false);
    });
  });

  describe('workspaceAiUsageByOperation()', () => {
    it('calls aiUsageByOperation service', async () => {
      await controller.workspaceAiUsageByOperation({
        period: 'day',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(aiService.aiUsageByOperation).toHaveBeenCalled();
    });

    it('has @RequireAbility for read_workspace_analytics on by-operation handler', () => {
      const fn = getAbilityFn(controller.workspaceAiUsageByOperation);
      expect(fn).toBeDefined();
    });
  });

  describe('workspaceAiUsageFailureRate()', () => {
    it('calls aiUsageFailureRate service', async () => {
      await controller.workspaceAiUsageFailureRate({
        period: 'day',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(aiService.aiUsageFailureRate).toHaveBeenCalled();
    });

    it('has @RequireAbility for read_workspace_analytics on failure-rate handler', () => {
      const fn = getAbilityFn(controller.workspaceAiUsageFailureRate);
      expect(fn).toBeDefined();
    });
  });
});
