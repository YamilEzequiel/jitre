import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NOTIFICATION_DRIVERS } from './drivers/notification-driver.interface';
import { NotificationType } from '@jitre/shared';
import { SettingsService } from '../settings/settings.service';

const makeInput = (recipientUserId = 'u-1', workspaceId = 'ws-1') => ({
  workspaceId,
  recipientUserId,
  type: NotificationType.WORKSPACE_INVITED,
  title: 'Invite',
});

const makeDriver = (name: string, sendImpl?: () => Promise<void>) => ({
  name,
  send: jest.fn(sendImpl ?? (() => Promise.resolve())),
});

// Helper: build a SettingsService mock where all notification flags are true (opt-out defaults)
const makeSettingsMock = (overrides: Record<string, unknown> = {}) => ({
  getNotificationSetting: jest.fn(
    async (_userId: string, _workspaceId: string, key: string, def: unknown) =>
      key in overrides ? overrides[key] : (def ?? true),
  ),
});

describe('NotificationDispatcherService', () => {
  let service: NotificationDispatcherService;

  const buildModule = async (
    drivers: ReturnType<typeof makeDriver>[],
    settingsMock = makeSettingsMock(),
  ) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDispatcherService,
        { provide: NOTIFICATION_DRIVERS, useValue: drivers },
        { provide: SettingsService, useValue: settingsMock },
      ],
    }).compile();
    service = module.get(NotificationDispatcherService);
  };

  describe('dispatch — baseline (all flags on)', () => {
    it('fans out to all drivers when all settings are enabled', async () => {
      const d1 = makeDriver('in-app');
      const d2 = makeDriver('email');
      await buildModule([d1, d2]);

      await service.dispatch(makeInput());

      expect(d1.send).toHaveBeenCalledTimes(1);
      expect(d2.send).toHaveBeenCalledTimes(1);
    });

    it('one driver throwing does not stop other drivers', async () => {
      const d1 = makeDriver('in-app', () =>
        Promise.reject(new Error('InApp broke')),
      );
      const d2 = makeDriver('email');
      await buildModule([d1, d2]);

      await expect(service.dispatch(makeInput())).resolves.toBeUndefined();

      expect(d2.send).toHaveBeenCalledTimes(1);
    });

    it('logs error when a driver throws', async () => {
      const logErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const d1 = makeDriver('in-app', () => Promise.reject(new Error('broke')));
      await buildModule([d1]);

      await service.dispatch(makeInput());

      expect(logErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('resolves even if all drivers throw', async () => {
      const d1 = makeDriver('in-app', () => Promise.reject(new Error('x')));
      const d2 = makeDriver('email', () => Promise.reject(new Error('y')));
      await buildModule([d1, d2]);

      await expect(service.dispatch(makeInput())).resolves.toBeUndefined();
    });
  });

  describe('dispatch — settings gating (opt-out behaviour)', () => {
    it('skips email driver when notification.email=false for recipient in workspace', async () => {
      const d1 = makeDriver('in-app');
      const d2 = makeDriver('email');
      const settings = makeSettingsMock({ 'notification.email': false });
      await buildModule([d1, d2], settings);

      await service.dispatch(makeInput());

      expect(d2.send).not.toHaveBeenCalled();
      expect(d1.send).toHaveBeenCalledTimes(1);
    });

    it('skips in-app driver when notification.in_app=false for recipient', async () => {
      const d1 = makeDriver('in-app');
      const d2 = makeDriver('email');
      const settings = makeSettingsMock({ 'notification.in_app': false });
      await buildModule([d1, d2], settings);

      await service.dispatch(makeInput());

      expect(d1.send).not.toHaveBeenCalled();
      expect(d2.send).toHaveBeenCalledTimes(1);
    });

    it('sends to no driver when both in_app and email are disabled', async () => {
      const d1 = makeDriver('in-app');
      const d2 = makeDriver('email');
      const settings = makeSettingsMock({
        'notification.in_app': false,
        'notification.email': false,
      });
      await buildModule([d1, d2], settings);

      await service.dispatch(makeInput());

      expect(d1.send).not.toHaveBeenCalled();
      expect(d2.send).not.toHaveBeenCalled();
    });

    it('defaults to sending (true) when setting is not found — opt-out not opt-in', async () => {
      // getNotificationSetting returns undefined → dispatcher must default to true
      const settings = {
        getNotificationSetting: jest.fn().mockResolvedValue(undefined),
      };
      const d1 = makeDriver('in-app');
      const d2 = makeDriver('email');
      await buildModule([d1, d2], settings);

      await service.dispatch(makeInput());

      // Both should still be called — undefined is treated as "not disabled"
      expect(d1.send).toHaveBeenCalledTimes(1);
      expect(d2.send).toHaveBeenCalledTimes(1);
    });

    it('calls getNotificationSetting with correct args for in-app driver', async () => {
      const settings = makeSettingsMock();
      const d1 = makeDriver('in-app');
      await buildModule([d1], settings);

      const input = makeInput('user-42', 'workspace-99');
      await service.dispatch(input);

      expect(settings.getNotificationSetting).toHaveBeenCalledWith(
        'user-42',
        'workspace-99',
        'notification.in_app',
        true,
      );
    });

    it('calls getNotificationSetting with correct args for email driver', async () => {
      const settings = makeSettingsMock();
      const d2 = makeDriver('email');
      await buildModule([d2], settings);

      const input = makeInput('user-42', 'workspace-99');
      await service.dispatch(input);

      expect(settings.getNotificationSetting).toHaveBeenCalledWith(
        'user-42',
        'workspace-99',
        'notification.email',
        true,
      );
    });
  });
});
