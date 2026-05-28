import { NotificationType } from '@jitre/shared';
import {
  ALWAYS_EMAIL_TYPES,
  buildEmailForNotification,
  NOTIFICATION_TYPE_SETTING_KEY,
} from './notification-email.template';
import { Notification } from '../../notification/notification.entity';

function makeNotif(over: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    workspaceId: 'ws-1',
    recipientUserId: 'u-1',
    type: NotificationType.TASK_ASSIGNED,
    title: 'Wire up email',
    body: 'Due Friday',
    data: { taskId: 'task-7', projectId: 'proj-3' },
    priority: 'normal',
    readAt: null,
    occurredAt: new Date(),
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

describe('buildEmailForNotification()', () => {
  it('renders a TASK_ASSIGNED email with the task in the subject and a CTA', () => {
    const { subject, html, text } = buildEmailForNotification(makeNotif(), {
      recipientName: 'Alice',
      workspaceName: 'Acme',
      appBaseUrl: 'https://app.jitre.test',
    });

    expect(subject).toContain('Wire up email');
    expect(html).toContain('Hi Alice,');
    expect(html).toContain('Acme');
    expect(html).toContain('https://app.jitre.test/tasks/task-7');
    expect(text).toContain('Wire up email');
  });

  it('omits the CTA when no appBaseUrl is provided', () => {
    const { html } = buildEmailForNotification(makeNotif(), {
      recipientName: 'Alice',
      appBaseUrl: null,
    });
    expect(html).not.toContain('Open task');
  });

  it('renders a WORKSPACE_INVITED email with the welcome title', () => {
    const { subject, html } = buildEmailForNotification(
      makeNotif({
        type: NotificationType.WORKSPACE_INVITED,
        title: 'You were added to Acme',
        data: { role: 'ADMIN' },
      }),
      { recipientName: 'Bob', workspaceName: 'Acme' },
    );

    expect(subject).toContain('Acme');
    expect(html).toContain('Welcome aboard');
    expect(html).toContain('ADMIN');
  });

  it('falls back to a generic body for unmapped types', () => {
    const { subject, html } = buildEmailForNotification(
      makeNotif({
        type: 'unknown.event' as unknown as NotificationType,
        title: 'Heads up',
        body: 'Something happened',
      }),
    );
    expect(subject).toContain('Heads up');
    expect(html).toContain('Something happened');
  });

  it('greets generically when no recipientName is provided', () => {
    const { html } = buildEmailForNotification(makeNotif());
    expect(html).toContain('Hi there,');
  });
});

describe('NOTIFICATION_TYPE_SETTING_KEY', () => {
  it('maps all settings-driven types to their notification.* key', () => {
    expect(NOTIFICATION_TYPE_SETTING_KEY[NotificationType.TASK_ASSIGNED]).toBe(
      'notification.task_assigned',
    );
    expect(NOTIFICATION_TYPE_SETTING_KEY[NotificationType.TASK_DUE_SOON]).toBe(
      'notification.task_due_soon',
    );
    expect(NOTIFICATION_TYPE_SETTING_KEY[NotificationType.TASK_COMPLETED]).toBe(
      'notification.task_completed',
    );
    expect(
      NOTIFICATION_TYPE_SETTING_KEY[NotificationType.TASK_STATUS_CHANGED],
    ).toBe('notification.task_status_changed');
    expect(
      NOTIFICATION_TYPE_SETTING_KEY[NotificationType.PROJECT_MEMBER_ADDED],
    ).toBe('notification.project_member_added');
    expect(
      NOTIFICATION_TYPE_SETTING_KEY[NotificationType.AI_QUOTA_WARNING],
    ).toBe('notification.ai_quota_warning');
  });
});

describe('ALWAYS_EMAIL_TYPES', () => {
  it('includes the workspace transactional types', () => {
    expect(ALWAYS_EMAIL_TYPES.has(NotificationType.WORKSPACE_INVITED)).toBe(
      true,
    );
    expect(
      ALWAYS_EMAIL_TYPES.has(NotificationType.WORKSPACE_OWNERSHIP_TRANSFERRED),
    ).toBe(true);
  });

  it('does not include type-gated events', () => {
    expect(ALWAYS_EMAIL_TYPES.has(NotificationType.TASK_ASSIGNED)).toBe(false);
    expect(ALWAYS_EMAIL_TYPES.has(NotificationType.AI_QUOTA_WARNING)).toBe(
      false,
    );
  });
});
