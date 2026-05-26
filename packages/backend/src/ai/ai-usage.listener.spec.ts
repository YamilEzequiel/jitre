import { Logger } from '@nestjs/common';
import { AiUsageListener } from './ai-usage.listener';
import { AiUsageService } from './ai-usage.service';
import { SettingsService } from '../settings/settings.service';
import { EventBusService } from '../events/event-bus.service';
import { AiRequestMadeEvent } from './events/ai-request-made.event';
import {
  NotificationType,
  AiProvider,
  AiOperation,
  WorkspaceRole,
} from '@jitre/shared';
import { Repository } from 'typeorm';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';
import { NotificationCreatedEvent } from '../notification/events/notification-created.event';
import { AiBudgetExceededEvent } from './events/ai-budget-exceeded.event';

function makeEvent(
  opts: {
    workspaceId?: string;
    userId?: string;
    costUsd?: string;
  } = {},
): AiRequestMadeEvent {
  return new AiRequestMadeEvent({
    aggregateId: opts.workspaceId ?? 'ws-1',
    aggregateType: 'Workspace',
    workspaceId: opts.workspaceId ?? 'ws-1',
    actorUserId: opts.userId ?? 'u-1',
    payload: {
      provider: AiProvider.GEMINI,
      model: 'gemini-2.0-flash-exp',
      operation: AiOperation.DESCRIBE,
      costUsd: opts.costUsd ?? '0.001000',
      totalTokens: 100,
    },
  });
}

const adminMemberships = [
  { userId: 'admin-1', workspaceId: 'ws-1', role: WorkspaceRole.ADMIN },
  { userId: 'admin-2', workspaceId: 'ws-1', role: WorkspaceRole.OWNER },
];

describe('AiUsageListener', () => {
  let listener: AiUsageListener;
  let mockUsageService: jest.Mocked<
    Pick<AiUsageService, 'dailyCostForWorkspace'>
  >;
  let mockSettings: jest.Mocked<
    Pick<SettingsService, 'getAiSetting' | 'getUserSetting'>
  >;
  let mockEventBus: jest.Mocked<Pick<EventBusService, 'publish'>>;
  let mockMembershipRepo: jest.Mocked<
    Pick<Repository<WorkspaceMembershipEntity>, 'find'>
  >;
  let mockLogger: Logger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsageService = {
      dailyCostForWorkspace: jest.fn(),
    };

    mockSettings = {
      getAiSetting: jest.fn(),
      getUserSetting: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
    };

    mockMembershipRepo = {
      find: jest.fn().mockResolvedValue(adminMemberships),
    };

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    listener = new AiUsageListener(
      mockUsageService as unknown as AiUsageService,
      mockSettings as unknown as SettingsService,
      mockEventBus as unknown as EventBusService,
      mockMembershipRepo as unknown as Repository<WorkspaceMembershipEntity>,
      mockLogger,
    );
  });

  describe('onAiRequestMade — below threshold (no notification)', () => {
    it('emits no notifications when cost is below 80% of budget', async () => {
      // budget=5.0, spent=3.0 → 60% — no warning
      mockSettings.getAiSetting.mockResolvedValue(5.0);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('3.000000');

      await listener.onAiRequestMade(makeEvent());

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('onAiRequestMade — crosses 80% threshold', () => {
    it('emits AI_QUOTA_WARNING notification for each admin when cost reaches 80%', async () => {
      // budget=5.0, spent=4.1 → 82% — warning
      mockSettings.getAiSetting.mockResolvedValue(5.0);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('4.100000');
      // notification.ai_quota_warning = true for both admins
      mockSettings.getUserSetting.mockResolvedValue(true);

      await listener.onAiRequestMade(makeEvent());

      const publishCalls = mockEventBus.publish.mock.calls;
      const notifCalls = publishCalls.filter(
        ([e]) => e instanceof NotificationCreatedEvent,
      );
      expect(notifCalls).toHaveLength(2); // one per admin
      expect(notifCalls[0][0].payload.type).toBe(
        NotificationType.AI_QUOTA_WARNING,
      );
    });

    it('does not emit warning when notification.ai_quota_warning is false for an admin', async () => {
      mockSettings.getAiSetting.mockResolvedValue(5.0);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('4.100000');
      // both admins have the setting disabled
      mockSettings.getUserSetting.mockResolvedValue(false);

      await listener.onAiRequestMade(makeEvent());

      const publishCalls = mockEventBus.publish.mock.calls;
      const notifCalls = publishCalls.filter(
        ([e]) => e instanceof NotificationCreatedEvent,
      );
      expect(notifCalls).toHaveLength(0);
    });

    it('deduplicates: does not emit a second 80% warning for the same workspace+day', async () => {
      mockSettings.getAiSetting.mockResolvedValue(5.0);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('4.100000');
      mockSettings.getUserSetting.mockResolvedValue(true);

      // First call — should warn
      await listener.onAiRequestMade(makeEvent());
      const callsAfterFirst = mockEventBus.publish.mock.calls.length;

      // Second call same day — should NOT warn again
      await listener.onAiRequestMade(makeEvent());
      const callsAfterSecond = mockEventBus.publish.mock.calls.length;

      expect(callsAfterSecond).toBe(callsAfterFirst); // no new calls
    });
  });

  describe('onAiRequestMade — exceeds 100% budget', () => {
    it('emits AI_BUDGET_EXCEEDED_NOTIFY notification for each admin when cost exceeds 100%', async () => {
      // budget=5.0, spent=5.2 → 104% — budget exceeded
      mockSettings.getAiSetting.mockResolvedValue(5.0);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('5.200000');
      mockSettings.getUserSetting.mockResolvedValue(true);

      await listener.onAiRequestMade(makeEvent());

      const publishCalls = mockEventBus.publish.mock.calls;
      const notifCalls = publishCalls.filter(
        ([e]) => e instanceof NotificationCreatedEvent,
      );
      // Both admins should get AI_BUDGET_EXCEEDED_NOTIFY
      expect(
        notifCalls.some(
          ([e]) =>
            e.payload.type === NotificationType.AI_BUDGET_EXCEEDED_NOTIFY,
        ),
      ).toBe(true);
    });

    it('emits ai.budget_exceeded domain event on first budget breach today', async () => {
      mockSettings.getAiSetting.mockResolvedValue(5.0);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('5.200000');
      mockSettings.getUserSetting.mockResolvedValue(true);

      await listener.onAiRequestMade(makeEvent());

      const publishCalls = mockEventBus.publish.mock.calls;
      const budgetExceededCalls = publishCalls.filter(
        ([e]) => e instanceof AiBudgetExceededEvent,
      );
      expect(budgetExceededCalls).toHaveLength(1);
    });

    it('deduplicates ai.budget_exceeded domain event: does not re-emit on same workspace+day', async () => {
      mockSettings.getAiSetting.mockResolvedValue(5.0);
      mockUsageService.dailyCostForWorkspace.mockResolvedValue('5.200000');
      mockSettings.getUserSetting.mockResolvedValue(true);

      await listener.onAiRequestMade(makeEvent());
      await listener.onAiRequestMade(makeEvent());

      const publishCalls = mockEventBus.publish.mock.calls;
      const budgetExceededCalls = publishCalls.filter(
        ([e]) => e instanceof AiBudgetExceededEvent,
      );
      expect(budgetExceededCalls).toHaveLength(1); // only once
    });
  });

  describe('error swallowing', () => {
    it('does not throw if usageService throws', async () => {
      mockSettings.getAiSetting.mockResolvedValue(5.0);
      mockUsageService.dailyCostForWorkspace.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        listener.onAiRequestMade(makeEvent()),
      ).resolves.not.toThrow();
    });
  });
});
