import { Test } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AiQuotaGuard } from './ai-quota.guard';
import { AiUsageService } from './ai-usage.service';
import { EventBusService } from '../events/event-bus.service';
import { SettingsService } from '../settings/settings.service';
import { RequestContextService } from '../request-context/request-context.service';
import { WorkspaceRole } from '@jitre/shared';
import { RateLimitHitException } from './exceptions/rate-limit-hit.exception';
import { BudgetExceededException } from './exceptions/budget-exceeded.exception';
import { AiBudgetExceededEvent } from './events/ai-budget-exceeded.event';

const mockUsageService = {
  dailyCountForUser: jest.fn(),
  dailyCountForWorkspace: jest.fn(),
  dailyCostForWorkspace: jest.fn(),
};

const mockEventBus = {
  publish: jest.fn(),
};

const mockSettings = {
  getAiSetting: jest.fn(),
};

const mockRequestContext = {
  getWorkspaceId: jest.fn().mockReturnValue('ws-1'),
  getUserId: jest.fn().mockReturnValue('u-1'),
  getRole: jest.fn().mockReturnValue(WorkspaceRole.MEMBER),
};

const mockExecutionContext = {
  switchToHttp: jest.fn().mockReturnValue({ getRequest: jest.fn() }),
} as unknown as ExecutionContext;

// Override env vars for testing
const originalEnv = process.env;

describe('AiQuotaGuard', () => {
  let guard: AiQuotaGuard;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set default env caps
    process.env.AI_MAX_REQUESTS_PER_USER_PER_DAY = '100';
    process.env.AI_MAX_REQUESTS_PER_DAY = '1000';
    process.env.AI_ADMIN_BYPASS_USER_CAP = 'true';

    const module = await Test.createTestingModule({
      providers: [
        AiQuotaGuard,
        { provide: AiUsageService, useValue: mockUsageService },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: SettingsService, useValue: mockSettings },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    guard = module.get(AiQuotaGuard);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('happy path', () => {
    it('returns true when all checks pass', async () => {
      mockUsageService.dailyCountForUser.mockResolvedValue(5);
      mockUsageService.dailyCountForWorkspace.mockResolvedValue(50);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('1.000000');
      mockSettings.getAiSetting.mockResolvedValue(5.0);

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('user cap exceeded', () => {
    it('throws RateLimitHitException(USER_DAILY_REQUESTS) when user count >= cap', async () => {
      mockUsageService.dailyCountForUser.mockResolvedValue(100); // at cap
      mockRequestContext.getRole.mockReturnValue(WorkspaceRole.MEMBER);

      await expect(
        guard.canActivate(mockExecutionContext),
      ).rejects.toBeInstanceOf(RateLimitHitException);
    });

    it('error includes USER_DAILY_REQUESTS limitType', async () => {
      mockUsageService.dailyCountForUser.mockResolvedValue(101);
      mockRequestContext.getRole.mockReturnValue(WorkspaceRole.MEMBER);

      try {
        await guard.canActivate(mockExecutionContext);
      } catch (e) {
        const response = (e as RateLimitHitException).getResponse() as Record<
          string,
          unknown
        >;
        expect(response.limitType).toBe('USER_DAILY_REQUESTS');
      }
    });
  });

  describe('admin bypass', () => {
    it('allows ADMIN to bypass user cap when AI_ADMIN_BYPASS_USER_CAP=true', async () => {
      process.env.AI_ADMIN_BYPASS_USER_CAP = 'true';
      mockRequestContext.getRole.mockReturnValue(WorkspaceRole.ADMIN);
      mockUsageService.dailyCountForUser.mockResolvedValue(999); // over cap
      mockUsageService.dailyCountForWorkspace.mockResolvedValue(50);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('1.000000');
      mockSettings.getAiSetting.mockResolvedValue(5.0);

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
      // User count check should have been skipped
      expect(mockUsageService.dailyCountForUser).not.toHaveBeenCalled();
    });

    it('does NOT bypass user cap when AI_ADMIN_BYPASS_USER_CAP=false', async () => {
      process.env.AI_ADMIN_BYPASS_USER_CAP = 'false';
      mockRequestContext.getRole.mockReturnValue(WorkspaceRole.ADMIN);
      mockUsageService.dailyCountForUser.mockResolvedValue(200); // over cap

      await expect(
        guard.canActivate(mockExecutionContext),
      ).rejects.toBeInstanceOf(RateLimitHitException);
    });
  });

  describe('workspace cap exceeded', () => {
    it('throws RateLimitHitException(WORKSPACE_DAILY_REQUESTS) when workspace count >= cap', async () => {
      mockUsageService.dailyCountForUser.mockResolvedValue(5);
      mockUsageService.dailyCountForWorkspace.mockResolvedValue(1000); // at cap
      mockRequestContext.getRole.mockReturnValue(WorkspaceRole.MEMBER);

      await expect(
        guard.canActivate(mockExecutionContext),
      ).rejects.toBeInstanceOf(RateLimitHitException);
    });

    it('error includes WORKSPACE_DAILY_REQUESTS limitType', async () => {
      mockUsageService.dailyCountForUser.mockResolvedValue(5);
      mockUsageService.dailyCountForWorkspace.mockResolvedValue(1001);
      mockRequestContext.getRole.mockReturnValue(WorkspaceRole.MEMBER);

      try {
        await guard.canActivate(mockExecutionContext);
      } catch (e) {
        const response = (e as RateLimitHitException).getResponse() as Record<
          string,
          unknown
        >;
        expect(response.limitType).toBe('WORKSPACE_DAILY_REQUESTS');
      }
    });
  });

  describe('budget exceeded', () => {
    it('throws BudgetExceededException when spent >= budget', async () => {
      mockUsageService.dailyCountForUser.mockResolvedValue(5);
      mockUsageService.dailyCountForWorkspace.mockResolvedValue(50);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('5.000001');
      mockSettings.getAiSetting.mockResolvedValue(5.0);

      await expect(
        guard.canActivate(mockExecutionContext),
      ).rejects.toBeInstanceOf(BudgetExceededException);
    });

    it('emits AiBudgetExceededEvent when budget is exceeded', async () => {
      mockUsageService.dailyCountForUser.mockResolvedValue(5);
      mockUsageService.dailyCountForWorkspace.mockResolvedValue(50);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('5.500000');
      mockSettings.getAiSetting.mockResolvedValue(5.0);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(AiBudgetExceededEvent),
      );
    });
  });

  describe('missing context', () => {
    it('throws ForbiddenException when workspaceId is null', async () => {
      mockRequestContext.getWorkspaceId.mockReturnValueOnce(null);

      await expect(
        guard.canActivate(mockExecutionContext),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
