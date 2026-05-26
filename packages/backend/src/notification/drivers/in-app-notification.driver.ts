import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification.service';
import type {
  INotificationDriver,
  NotificationDispatchInput,
} from './notification-driver.interface';

@Injectable()
export class InAppNotificationDriver implements INotificationDriver {
  readonly name = 'in-app';

  constructor(private readonly notificationService: NotificationService) {}

  async send(input: NotificationDispatchInput): Promise<void> {
    await this.notificationService.create(input);
  }
}
