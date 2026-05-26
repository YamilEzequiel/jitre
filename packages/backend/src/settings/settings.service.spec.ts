import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { UserSetting } from './user-setting.entity';
import { WorkspaceSetting } from './workspace-setting.entity';
import { AiSetting } from './ai-setting.entity';
import { NotificationSetting } from './notification-setting.entity';

const makeRepo = () => ({
  findOne: jest.fn(),
  upsert: jest.fn().mockResolvedValue(undefined),
});

describe('SettingsService', () => {
  let service: SettingsService;
  let userRepo: ReturnType<typeof makeRepo>;
  let workspaceRepo: ReturnType<typeof makeRepo>;
  let aiRepo: ReturnType<typeof makeRepo>;
  let notificationRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    userRepo = makeRepo();
    workspaceRepo = makeRepo();
    aiRepo = makeRepo();
    notificationRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(UserSetting), useValue: userRepo },
        {
          provide: getRepositoryToken(WorkspaceSetting),
          useValue: workspaceRepo,
        },
        { provide: getRepositoryToken(AiSetting), useValue: aiRepo },
        {
          provide: getRepositoryToken(NotificationSetting),
          useValue: notificationRepo,
        },
      ],
    }).compile();

    service = module.get(SettingsService);
    jest.clearAllMocks();
  });

  describe('setUserSetting()', () => {
    it('throws BadRequestException for unknown user key', async () => {
      await expect(
        service.setUserSetting('U1', 'user.banana', 'yellow'),
      ).rejects.toThrow(BadRequestException);
    });

    it('upserts a valid user key', async () => {
      await service.setUserSetting('U1', 'user.timezone', 'UTC+3');
      expect(userRepo.upsert).toHaveBeenCalled();
    });
  });

  describe('getNotificationSetting() — precedence chain', () => {
    it('per-workspace-user beats user-global', async () => {
      // findOne called twice: first for (user, workspace), second for (user, null)
      notificationRepo.findOne
        .mockResolvedValueOnce({ value: true }) // per-workspace-user → true
        .mockResolvedValueOnce({ value: false }); // user-global → would be false

      const result = await service.getNotificationSetting(
        'U1',
        'W1',
        'notification.email',
        true,
      );
      expect(result).toBe(true);
    });

    it('user-global beats workspace when no per-workspace-user row', async () => {
      notificationRepo.findOne
        .mockResolvedValueOnce(null) // per-workspace-user → not found
        .mockResolvedValueOnce({ value: false }); // user-global → false

      const result = await service.getNotificationSetting(
        'U1',
        'W1',
        'notification.email',
        true,
      );
      expect(result).toBe(false);
    });

    it('workspace beats hardcoded default when user has no rows', async () => {
      notificationRepo.findOne
        .mockResolvedValueOnce(null) // per-workspace-user → not found
        .mockResolvedValueOnce(null); // user-global → not found
      workspaceRepo.findOne.mockResolvedValue({ value: false }); // workspace → false

      const result = await service.getNotificationSetting(
        'U1',
        'W1',
        'notification.in_app',
        true,
      );
      expect(result).toBe(false);
    });

    it('falls back to hardcoded default when nothing is set', async () => {
      notificationRepo.findOne.mockResolvedValue(null);
      workspaceRepo.findOne.mockResolvedValue(null);

      const result = await service.getNotificationSetting(
        'U1',
        'W1',
        'notification.email',
        true,
      );
      expect(result).toBe(true); // DEFAULT_VALUES['notification.email'] = true
    });
  });

  // ── J2 — Settings validators (Fase 7) ─────────────────────────────────────

  describe('setWorkspaceSetting() — J2 validators', () => {
    it('throws BadRequestException for negative ai.daily_budget_usd', async () => {
      await expect(
        service.setAiSetting('W1', 'ai.daily_budget_usd', -1),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for zero ai.daily_budget_usd', async () => {
      await expect(
        service.setAiSetting('W1', 'ai.daily_budget_usd', 0),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for NaN ai.daily_budget_usd', async () => {
      await expect(
        service.setAiSetting('W1', 'ai.daily_budget_usd', NaN),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a positive ai.daily_budget_usd', async () => {
      aiRepo.upsert.mockResolvedValue(undefined);
      await expect(
        service.setAiSetting('W1', 'ai.daily_budget_usd', 10.0),
      ).resolves.toBeUndefined();
    });

    it('rejects AI providers that are still runtime stubs', async () => {
      await expect(
        service.setAiSetting('W1', 'ai.provider', 'OPENAI'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.setAiSetting('W1', 'ai.provider', 'ANTHROPIC'),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts the implemented Gemini provider', async () => {
      await expect(
        service.setAiSetting('W1', 'ai.provider', 'GEMINI'),
      ).resolves.toBeUndefined();
    });

    it('throws BadRequestException for zero notification.task_due_soon_window_days', async () => {
      await expect(
        service.setWorkspaceSetting(
          'W1',
          'notification.task_due_soon_window_days',
          0,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for negative notification.task_due_soon_window_days', async () => {
      await expect(
        service.setWorkspaceSetting(
          'W1',
          'notification.task_due_soon_window_days',
          -1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for non-integer notification.task_due_soon_window_days', async () => {
      await expect(
        service.setWorkspaceSetting(
          'W1',
          'notification.task_due_soon_window_days',
          1.5,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a positive integer notification.task_due_soon_window_days', async () => {
      workspaceRepo.upsert.mockResolvedValue(undefined);
      await expect(
        service.setWorkspaceSetting(
          'W1',
          'notification.task_due_soon_window_days',
          7,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('getMergedUserPreferences()', () => {
    it('returns a shape with notifications, ai, user, workspace keys', async () => {
      // All repos return null → defaults apply
      notificationRepo.findOne.mockResolvedValue(null);
      workspaceRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(null);
      aiRepo.findOne.mockResolvedValue(null);

      const prefs = await service.getMergedUserPreferences('U1', 'W1');
      expect(prefs).toHaveProperty('notifications');
      expect(prefs).toHaveProperty('ai');
      expect(prefs).toHaveProperty('user');
      expect(prefs).toHaveProperty('workspace');
    });

    it('notification defaults to true for in_app and email', async () => {
      notificationRepo.findOne.mockResolvedValue(null);
      workspaceRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(null);
      aiRepo.findOne.mockResolvedValue(null);

      const prefs = await service.getMergedUserPreferences('U1', 'W1');
      expect(prefs.notifications.in_app).toBe(true);
      expect(prefs.notifications.email).toBe(true);
      expect(prefs.notifications.task_assigned).toBe(true);
      expect(prefs.notifications.task_due_soon).toBe(true);
      expect(prefs.notifications.task_completed).toBe(true);
      expect(prefs.notifications.task_status_changed).toBe(true);
      expect(prefs.notifications.project_member_added).toBe(true);
      expect(prefs.notifications.ai_quota_warning).toBe(true);
    });
  });
});
