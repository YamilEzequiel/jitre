import { DomainEvent } from '../../events/domain-event.base';
import { NotificationType } from '@jitre/shared';

export interface NotificationCreatedPayload {
  notificationId: string;
  recipientUserId: string;
  type: NotificationType;
}

export class NotificationCreatedEvent extends DomainEvent<NotificationCreatedPayload> {
  static readonly aggregateType = 'Notification';

  get name(): string {
    return 'notification.created';
  }
}
