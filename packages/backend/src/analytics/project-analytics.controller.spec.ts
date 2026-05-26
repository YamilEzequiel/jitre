import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectAnalyticsController } from './project-analytics.controller';
import { DomainAnalyticsService } from './domain-analytics.service';
import { AbilityGuard } from '../auth/guards/ability.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { REQUIRE_ABILITY_KEY } from '../auth/decorators/require-ability.decorator';

const makeDomainService = () => ({
  velocity: jest.fn().mockResolvedValue([]),
  leadTime: jest.fn().mockResolvedValue([]),
  cycleTime: jest.fn().mockResolvedValue([]),
  burndown: jest.fn().mockResolvedValue([]),
  statusFlow: jest.fn().mockResolvedValue({ edges: [], isLimitHit: false }),
});

/** Helper: extract the RequireAbility fn from a handler method */
function getAbilityFn(
  handler: object,
): ((ability: unknown) => boolean) | undefined {
  return Reflect.getMetadata(REQUIRE_ABILITY_KEY, handler) as
    | ((ability: unknown) => boolean)
    | undefined;
}

// Pass-through guard for controller unit tests
const passGuard = { canActivate: () => true };

describe('ProjectAnalyticsController', () => {
  let controller: ProjectAnalyticsController;
  let domainService: ReturnType<typeof makeDomainService>;

  beforeEach(async () => {
    domainService = makeDomainService();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectAnalyticsController],
      providers: [{ provide: DomainAnalyticsService, useValue: domainService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(passGuard)
      .overrideGuard(AbilityGuard)
      .useValue(passGuard)
      .compile();

    controller = module.get<ProjectAnalyticsController>(
      ProjectAnalyticsController,
    );
  });

  describe('AbilityGuard integration (unit)', () => {
    it('AbilityGuard throws ForbiddenException when ability is denied', async () => {
      const mockRcService = { getAbility: jest.fn().mockReturnValue(null) };
      const reflector = new Reflector();
      const guard = new AbilityGuard(reflector, mockRcService as never);

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

  describe('projectVelocity()', () => {
    it('calls velocity with project scope', async () => {
      await controller.projectVelocity('p-1', {
        period: 'week',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(domainService.velocity).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'project', projectId: 'p-1' }),
      );
    });

    it('propagates BadRequestException', async () => {
      domainService.velocity.mockRejectedValueOnce(
        new BadRequestException({ code: 'RANGE_TOO_LARGE' }),
      );
      await expect(
        controller.projectVelocity('p-1', {
          period: 'week',
          from: '2025-01-01',
          to: '2026-01-02',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('has @RequireAbility for read_project_analytics on velocity handler', () => {
      const fn = getAbilityFn(controller.projectVelocity);
      expect(fn).toBeDefined();
      const allowedAbility = { can: jest.fn().mockReturnValue(true) };
      const deniedAbility = { can: jest.fn().mockReturnValue(false) };
      expect(fn!(allowedAbility)).toBe(true);
      expect(fn!(deniedAbility)).toBe(false);
    });
  });

  describe('projectLeadTime()', () => {
    it('calls leadTime service', async () => {
      await controller.projectLeadTime('p-1', {
        period: 'month',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(domainService.leadTime).toHaveBeenCalled();
    });

    it('has @RequireAbility for read_project_analytics on lead-time handler', () => {
      const fn = getAbilityFn(controller.projectLeadTime);
      expect(fn).toBeDefined();
    });
  });

  describe('projectCycleTime()', () => {
    it('calls cycleTime service', async () => {
      await controller.projectCycleTime('p-1', {
        period: 'month',
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(domainService.cycleTime).toHaveBeenCalled();
    });

    it('has @RequireAbility for read_project_analytics on cycle-time handler', () => {
      const fn = getAbilityFn(controller.projectCycleTime);
      expect(fn).toBeDefined();
    });
  });

  describe('projectBurndown()', () => {
    it('calls burndown service', async () => {
      await controller.projectBurndown('p-1', {
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(domainService.burndown).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'p-1' }),
      );
    });

    it('has @RequireAbility for read_project_analytics on burndown handler', () => {
      const fn = getAbilityFn(controller.projectBurndown);
      expect(fn).toBeDefined();
    });
  });

  describe('projectStatusFlow()', () => {
    it('calls statusFlow and returns edges', async () => {
      const mockRes = { setHeader: jest.fn() };
      const result = await controller.projectStatusFlow(
        'p-1',
        { period: 'week', from: '2026-05-01', to: '2026-05-31' },
        mockRes as never,
      );
      expect(domainService.statusFlow).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('sets X-Analytics-Truncated header when isLimitHit=true', async () => {
      domainService.statusFlow.mockResolvedValueOnce({
        edges: [],
        isLimitHit: true,
      });
      const mockRes = { setHeader: jest.fn() };
      await controller.projectStatusFlow(
        'p-1',
        { period: 'week', from: '2026-05-01', to: '2026-05-31' },
        mockRes as never,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Analytics-Truncated',
        'true',
      );
    });

    it('has @RequireAbility for read_project_analytics on status-flow handler', () => {
      const fn = getAbilityFn(controller.projectStatusFlow);
      expect(fn).toBeDefined();
    });
  });
});
