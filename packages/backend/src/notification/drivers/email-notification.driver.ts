import { Injectable, Logger } from '@nestjs/common';
import type {
  INotificationDriver,
  NotificationDispatchInput,
} from './notification-driver.interface';

// STUB: No outbound HTTP or mail provider configured.
// Real driver lands in Fase 5+. Interface frozen now to prevent breakage later.
@Injectable()
export class EmailNotificationDriver implements INotificationDriver {
  private readonly logger = new Logger(EmailNotificationDriver.name);
  readonly name = 'email';

  send(input: NotificationDispatchInput): Promise<void> {
    this.logger.log(
      `[STUB email] would send to ${input.recipientUserId}: ${input.title}`,
    );
    return Promise.resolve();
  }
}
