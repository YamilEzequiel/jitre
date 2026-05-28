import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationType } from '@jitre/shared';
import { NotificationEmailListener } from './notification-email.listener';
import { EmailService } from './email.service';
import { SettingsService } from '../settings/settings.service';
import { Notification } from '../notification/notification.entity';
import { UserEntity } from '../user/user.entity';
import { WorkspaceEntity } from '../workspace/workspace.entity';

interface Mocks {
  notifRepo: { findOne: jest.Mock; update: jest.Mock };
  userRepo: { findOne: jest.Mock };
  workspaceRepo: { findOne: jest.Mock };
  email: { send: jest.Mock };
  settings: { getNotificationSetting: jest.Mock };
  config: { get: jest.Mock };
}

function makeNotification(over: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    workspaceId: 'ws-1',
    recipientUserId: 'user-1',
    type: NotificationType.TASK_ASSIGNED,
    title: 'Wire up the email layer',
    body: 'Due Friday',
    data: { taskId: 'task-99', projectId: 'proj-7' },
    priority: 'normal',
    readAt: null,
    occurredAt: new Date('2026-05-28T10:00:00Z'),
    emailSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...over,
  } as unknown as Notification;
}

async function buildListener(notif: Notification, prefs: Record<string, unknown>) {
  const mocks: Mocks = {
    notifRepo: {
      findOne: jest.fn().mockResolvedValue(notif),
      update: jest.fn().mockResolvedValue(undefined),
    },
    userRepo: {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'recipient@example.com',
        displayName: 'Recipient',
      }),
    },
    workspaceRepo: {
      findOne: jest.fn().mockResolvedValue({ id: 'ws-1', name: 'Acme' }),
    },
    email: { send: jest.fn().mockResolvedValue(undefined) },
    settings: {
      getNotificationSetting: jest
        .fn()
        .mockImplementation((_uid, _wid, key, dflt) =>
          Promise.resolve(key in prefs ? prefs[key] : dflt),
        ),
    },
    config: { get: jest.fn().mockReturnValue('https://app.jitre.test') },
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NotificationEmailListener,
      { provide: getRepositoryToken(Notification), useValue: mocks.notifRepo },
      { provide: getRepositoryToken(UserEntity), useValue: mocks.userRepo },
      { provide: getRepositoryToken(WorkspaceEntity), useValue: mocks.workspaceRepo },
      { provide: EmailService, useValue: mocks.email },
      { provide: SettingsService, useValue: mocks.settings },
      { provide: ConfigService, useValue: mocks.config },
    ],
  }).compile();

  return {
    listener: module.get(NotificationEmailListener),
    mocks,
  };
}

const event = {
  workspaceId: 'ws-1',
  payload: {
    notificationId: 'notif-1',
    recipientUserId: 'user-1',
    type: NotificationType.TASK_ASSIGNED,
  },
};

describe('NotificationEmailListener', () => {
  describe('gating via notification settings', () => {
    it('drops when the master notification.email switch is off', async () => {
      const { listener, mocks } = await buildListener(makeNotification(), {
        'notification.email': false,
      });

      await listener.onCreated(event);

      expect(mocks.email.send).not.toHaveBeenCalled();
      expect(mocks.notifRepo.update).not.toHaveBeenCalled();
    });

    it('drops when the per-type setting is off (task_assigned)', async () => {
      const { listener, mocks } = await buildListener(makeNotification(), {
        'notification.email': true,
        'notification.task_assigned': false,
      });

      await listener.onCreated(event);

      expect(mocks.email.send).not.toHaveBeenCalled();
    });

    it('sends when master + per-type are both on', async () => {
      const { listener, mocks } = await buildListener(makeNotification(), {
        'notification.email': true,
        'notification.task_assigned': true,
      });

      await listener.onCreated(event);

      expect(mocks.email.send).toHaveBeenCalledTimes(1);
      const args = mocks.email.send.mock.calls[0][0];
      expect(args.to).toBe('recipient@example.com');
      expect(args.subject).toContain('Wire up the email layer');
      expect(args.html).toContain('<html');
      expect(args.text).toContain('Wire up the email layer');
      expect(mocks.notifRepo.update).toHaveBeenCalledWith('notif-1', {
        emailSentAt: expect.any(Date),
      });
    });

    it('bypasses per-type gate for WORKSPACE_INVITED transactional email', async () => {
      const notif = makeNotification({
        type: NotificationType.WORKSPACE_INVITED,
        title: 'You were added to Acme',
      });
      const transactionalEvent = {
        ...event,
        payload: { ...event.payload, type: NotificationType.WORKSPACE_INVITED },
      };
      const { listener, mocks } = await buildListener(notif, {
        'notification.email': true,
        'notification.task_assigned': false,
        'notification.project_member_added': false,
      });

      await listener.onCreated(transactionalEvent);

      expect(mocks.email.send).toHaveBeenCalledTimes(1);
    });

    it('still drops transactional types if master is off', async () => {
      const notif = makeNotification({
        type: NotificationType.WORKSPACE_INVITED,
      });
      const transactionalEvent = {
        ...event,
        payload: { ...event.payload, type: NotificationType.WORKSPACE_INVITED },
      };
      const { listener, mocks } = await buildListener(notif, {
        'notification.email': false,
      });

      await listener.onCreated(transactionalEvent);

      expect(mocks.email.send).not.toHaveBeenCalled();
    });
  });

  describe('idempotency + safety', () => {
    it('skips when emailSentAt is already set', async () => {
      const { listener, mocks } = await buildListener(
        makeNotification({ emailSentAt: new Date() }),
        { 'notification.email': true },
      );

      await listener.onCreated(event);

      expect(mocks.email.send).not.toHaveBeenCalled();
      expect(mocks.notifRepo.update).not.toHaveBeenCalled();
    });

    it('skips when the user has no email on file', async () => {
      const { listener, mocks } = await buildListener(makeNotification(), {
        'notification.email': true,
      });
      mocks.userRepo.findOne.mockResolvedValueOnce({
        id: 'user-1',
        email: null,
        displayName: 'Recipient',
      });

      await listener.onCreated(event);

      expect(mocks.email.send).not.toHaveBeenCalled();
    });

    it('swallows errors so unrelated work is not impacted', async () => {
      const { listener, mocks } = await buildListener(makeNotification(), {
        'notification.email': true,
      });
      mocks.email.send.mockRejectedValueOnce(new Error('smtp down'));

      await expect(listener.onCreated(event)).resolves.toBeUndefined();
    });
  });
});
