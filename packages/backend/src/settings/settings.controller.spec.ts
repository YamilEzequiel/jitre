import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

const mockService = {
  getMergedUserPreferences: jest.fn().mockResolvedValue({
    notifications: {
      in_app: true,
      email: true,
      batching_window_minutes: 0,
      task_assigned: true,
      task_due_soon: true,
      task_completed: true,
      task_status_changed: true,
      project_member_added: true,
      ai_quota_warning: true,
    },
    ai: {
      'ai.gemini.model': 'gpt-4',
      'ai.gemini.temperature': 0.7,
      'ai.enabled': false,
    },
    user: {
      'user.timezone': 'UTC',
      'user.locale': 'en',
      'user.theme': 'system',
    },
    workspace: {
      'workspace.default_locale': 'en',
      'workspace.allowed_domains': [],
      'workspace.invite_only': false,
    },
  }),
  setUserSetting: jest.fn().mockResolvedValue(undefined),
  setNotificationSetting: jest.fn().mockResolvedValue(undefined),
  setWorkspaceSetting: jest.fn().mockResolvedValue(undefined),
  setAiSetting: jest.fn().mockResolvedValue(undefined),
  getWorkspaceSetting: jest.fn().mockResolvedValue('en'),
  getAiSetting: jest.fn().mockResolvedValue('gemini-1.5-pro'),
};

describe('SettingsController', () => {
  let controller: SettingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: SettingsService, useValue: mockService },
        Reflector,
      ],
    }).compile();
    controller = module.get(SettingsController);
    jest.clearAllMocks();
  });

  describe('getMySettings()', () => {
    it('returns merged user preferences', async () => {
      const req = {
        user: { userId: 'U1' },
        headers: { 'x-workspace-id': 'W1' },
      };
      const result = await controller.getMySettings(req as never);
      expect(mockService.getMergedUserPreferences).toHaveBeenCalledWith(
        'U1',
        'W1',
      );
      expect(result).toHaveProperty('notifications');
    });
  });

  describe('patchMySettings()', () => {
    it('rejects workspace key via /settings/me (400)', async () => {
      const req = {
        user: { userId: 'U1' },
        headers: { 'x-workspace-id': 'W1' },
      };
      await expect(
        controller.patchMySettings(req as never, {
          key: 'workspace.default_locale',
          value: 'es',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts user key via /settings/me', async () => {
      const req = {
        user: { userId: 'U1' },
        headers: { 'x-workspace-id': 'W1' },
      };
      await controller.patchMySettings(req as never, {
        key: 'user.timezone',
        value: 'UTC+3',
      });
      expect(mockService.setUserSetting).toHaveBeenCalledWith(
        'U1',
        'user.timezone',
        'UTC+3',
      );
    });

    it('stores a supported notification preference for the active workspace', async () => {
      const req = {
        user: { userId: 'U1' },
        headers: { 'x-workspace-id': 'W1' },
      };
      await controller.patchMySettings(req as never, {
        key: 'notification.task_due_soon',
        value: false,
      });
      expect(mockService.setNotificationSetting).toHaveBeenCalledWith(
        'U1',
        'W1',
        'notification.task_due_soon',
        false,
      );
    });
  });

  describe('UpdateSettingDto validation', () => {
    it('rejects unknown key', async () => {
      const dto = plainToInstance(UpdateSettingDto, {
        key: 'user.banana',
        value: 'yellow',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'key')).toBe(true);
    });

    it('accepts known key', async () => {
      const dto = plainToInstance(UpdateSettingDto, {
        key: 'user.timezone',
        value: 'UTC',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
