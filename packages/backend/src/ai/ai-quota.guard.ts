import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WorkspaceRole } from '@jitre/shared';
import { SettingsService } from '../settings/settings.service';
import { EventBusService } from '../events/event-bus.service';
import { RequestContextService } from '../request-context/request-context.service';
import { AiUsageService } from './ai-usage.service';
import { RateLimitHitException } from './exceptions/rate-limit-hit.exception';
import { BudgetExceededException } from './exceptions/budget-exceeded.exception';
import { AiBudgetExceededEvent } from './events/ai-budget-exceeded.event';

function startOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isAdminRole(role: WorkspaceRole | null): boolean {
  return role === WorkspaceRole.ADMIN || role === WorkspaceRole.OWNER;
}

@Injectable()
export class AiQuotaGuard implements CanActivate {
  constructor(
    private readonly settings: SettingsService,
    private readonly usage: AiUsageService,
    private readonly requestContext: RequestContextService,
    private readonly eventBus: EventBusService,
  ) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const workspaceId = this.requestContext.getWorkspaceId();
    const userId = this.requestContext.getUserId();

    if (!workspaceId || !userId) {
      throw new ForbiddenException('UNAUTHENTICATED');
    }

    const today = startOfUtcDay(new Date());
    const role = this.requestContext.getRole();

    const adminBypass =
      process.env.AI_ADMIN_BYPASS_USER_CAP !== 'false' && isAdminRole(role);

    // 1. Per-user daily request cap (env)
    if (!adminBypass) {
      const userCap = parseInt(
        process.env.AI_MAX_REQUESTS_PER_USER_PER_DAY ?? '100',
        10,
      );
      const userCount = await this.usage.dailyCountForUser(
        workspaceId,
        userId,
        today,
      );
      if (userCount >= userCap) {
        throw new RateLimitHitException('USER_DAILY_REQUESTS');
      }
    }

    // 2. Per-workspace daily request cap (env) — no bypass
    const wsCap = parseInt(process.env.AI_MAX_REQUESTS_PER_DAY ?? '1000', 10);
    const wsCount = await this.usage.dailyCountForWorkspace(workspaceId, today);
    if (wsCount >= wsCap) {
      throw new RateLimitHitException('WORKSPACE_DAILY_REQUESTS');
    }

    // 3. Per-workspace daily USD budget (setting)
    const budget = await this.settings.getAiSetting<number>(
      workspaceId,
      'ai.daily_budget_usd',
      5.0,
    );
    const spent = await this.usage.dailyCostForWorkspace(workspaceId, today);

    if (parseFloat(spent) >= budget) {
      this.eventBus.publish(
        new AiBudgetExceededEvent({
          aggregateId: workspaceId,
          aggregateType: 'Workspace',
          workspaceId,
          actorUserId: userId,
          payload: { spent, budget, currency: 'USD' },
        }),
      );
      throw new BudgetExceededException(spent, budget);
    }

    return true;
  }
}
