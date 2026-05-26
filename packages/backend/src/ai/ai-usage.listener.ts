import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationType, WorkspaceRole } from '@jitre/shared';
import { AiUsageService } from './ai-usage.service';
import { SettingsService } from '../settings/settings.service';
import { EventBusService } from '../events/event-bus.service';
import { AiRequestMadeEvent } from './events/ai-request-made.event';
import { AiBudgetExceededEvent } from './events/ai-budget-exceeded.event';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';
import { NotificationCreatedEvent } from '../notification/events/notification-created.event';

function startOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function todayKey(): string {
  return startOfUtcDay(new Date()).toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Listens to ai.request_made and enforces budget warning + exceeded notifications.
 *
 * - At >= 80% of daily budget (first time today per workspace): emits AI_QUOTA_WARNING
 *   notifications to workspace admins (gated by notification.ai_quota_warning setting).
 * - At > 100% of daily budget: emits AI_BUDGET_EXCEEDED_NOTIFY notifications to admins
 *   AND publishes ai.budget_exceeded domain event (once per workspace per UTC day).
 */
@Injectable()
export class AiUsageListener {
  /** In-memory dedup: Set of "workspaceId:YYYY-MM-DD" keys for 80%-warning already sent. */
  private readonly warnedToday = new Set<string>();

  /** In-memory dedup: Set of "workspaceId:YYYY-MM-DD" keys for budget_exceeded already emitted. */
  private readonly budgetExceededToday = new Set<string>();

  constructor(
    private readonly usageService: AiUsageService,
    private readonly settings: SettingsService,
    private readonly eventBus: EventBusService,
    @InjectRepository(WorkspaceMembershipEntity)
    private readonly membershipRepo: Repository<WorkspaceMembershipEntity>,
    private readonly logger: Logger,
  ) {}

  @OnEvent('ai.request_made')
  async onAiRequestMade(event: AiRequestMadeEvent): Promise<void> {
    try {
      const workspaceId = event.workspaceId!;
      const today = startOfUtcDay(new Date());
      const dayKey = `${workspaceId}:${todayKey()}`;

      // Read current daily cost and budget
      const budget = await this.settings.getAiSetting<number>(
        workspaceId,
        'ai.daily_budget_usd',
        5.0,
      );
      const spent = parseFloat(
        await this.usageService.dailyCostForWorkspace(workspaceId, today),
      );

      const pct = budget > 0 ? spent / budget : 0;

      if (pct > 1.0) {
        // Budget exceeded: notify admins + emit domain event (idempotent per day)
        await this.notifyAdmins(
          workspaceId,
          NotificationType.AI_BUDGET_EXCEEDED_NOTIFY,
          `AI daily budget exceeded for workspace ${workspaceId}`,
        );

        if (!this.budgetExceededToday.has(dayKey)) {
          this.budgetExceededToday.add(dayKey);
          this.eventBus.publish(
            new AiBudgetExceededEvent({
              aggregateId: workspaceId,
              aggregateType: 'Workspace',
              workspaceId,
              payload: {
                spent: spent.toFixed(6),
                budget,
                currency: 'USD',
              },
            }),
          );
        }
      } else if (pct >= 0.8) {
        // 80% threshold: warn admins (idempotent per day)
        if (!this.warnedToday.has(dayKey)) {
          this.warnedToday.add(dayKey);
          await this.notifyAdmins(
            workspaceId,
            NotificationType.AI_QUOTA_WARNING,
            `AI daily budget is at ${Math.round(pct * 100)}% for workspace ${workspaceId}`,
          );
        }
      }
    } catch (err: unknown) {
      this.logger.error({
        event: 'ai.usage.listener.error',
        err,
      });
    }
  }

  private async notifyAdmins(
    workspaceId: string,
    type: NotificationType,
    _message: string,
  ): Promise<void> {
    const admins = await this.membershipRepo.find({
      where: [
        { workspaceId, role: WorkspaceRole.ADMIN },
        { workspaceId, role: WorkspaceRole.OWNER },
      ],
    });

    for (const admin of admins) {
      // Gate on user notification preference
      const enabled = await this.settings.getUserSetting<boolean>(
        admin.userId,
        'notification.ai_quota_warning',
      );
      if (enabled === false) continue;

      this.eventBus.publish(
        new NotificationCreatedEvent({
          aggregateId: `${workspaceId}:${admin.userId}:${type}`,
          aggregateType: 'Notification',
          workspaceId,
          payload: {
            notificationId: `${workspaceId}:${admin.userId}:${type}`,
            recipientUserId: admin.userId,
            type,
          },
        }),
      );
    }
  }
}
