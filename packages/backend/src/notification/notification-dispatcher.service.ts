import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  INotificationDriver,
  NotificationDispatchInput,
} from './drivers/notification-driver.interface';
import { NOTIFICATION_DRIVERS } from './drivers/notification-driver.interface';
import { SettingsService } from '../settings/settings.service';

/** Map driver.name → notification settings key */
const DRIVER_KEY_MAP: Record<string, string> = {
  'in-app': 'notification.in_app',
  email: 'notification.email',
};

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    @Inject(NOTIFICATION_DRIVERS)
    private readonly drivers: INotificationDriver[],
    private readonly settingsService: SettingsService,
  ) {}

  async dispatch(input: NotificationDispatchInput): Promise<void> {
    const { recipientUserId, workspaceId } = input;

    // Cache per-recipient resolutions within this dispatch call to avoid N×M DB round-trips.
    const cache = new Map<string, boolean>();

    for (const driver of this.drivers) {
      const settingKey =
        DRIVER_KEY_MAP[driver.name] ?? `notification.${driver.name}`;

      let enabled: boolean;
      if (cache.has(settingKey)) {
        enabled = cache.get(settingKey)!;
      } else {
        const raw = await this.settingsService.getNotificationSetting(
          recipientUserId,
          workspaceId,
          settingKey,
          true, // opt-out default: send unless explicitly disabled
        );
        // Treat undefined/null as "not disabled" — preserves existing behaviour
        enabled = raw !== false && raw !== null;
        cache.set(settingKey, enabled);
      }

      if (!enabled) continue;

      try {
        await driver.send(input);
      } catch (err) {
        this.logger.error(
          { driver: driver.name, err },
          'Notification driver failed',
        );
      }
    }
  }
}
