import { NotificationType } from '@jitre/shared';

export interface NotificationDispatchInput {
  workspaceId: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high';
}

export interface INotificationDriver {
  readonly name: string;
  send(input: NotificationDispatchInput): Promise<void>;
}

export const NOTIFICATION_DRIVERS = Symbol('NOTIFICATION_DRIVERS');
