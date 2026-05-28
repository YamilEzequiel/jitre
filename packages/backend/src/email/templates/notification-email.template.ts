import { NotificationType } from '@jitre/shared';
import { Notification } from '../../notification/notification.entity';
import { EmailBlock, renderLayout, RenderedEmail } from './layout';

export interface NotificationEmailContext {
  /** Recipient's display name. Falls back to "there" if missing. */
  recipientName?: string | null;
  /** Workspace display name for the header chip. */
  workspaceName?: string | null;
  /**
   * Public base URL for CTAs (e.g. "https://app.jitre.dev"). The renderer
   * appends entity paths from `notification.data` when present. When unset,
   * the CTA is omitted rather than producing a broken link.
   */
  appBaseUrl?: string | null;
}

export interface BuiltNotificationEmail extends RenderedEmail {
  subject: string;
}

/**
 * Renders an email body for one notification row. Picks subject, intro,
 * content blocks and CTA based on `notification.type`; falls back to a
 * generic body that mirrors the in-app notification when no specific
 * handler exists.
 */
export function buildEmailForNotification(
  notification: Notification,
  context: NotificationEmailContext = {},
): BuiltNotificationEmail {
  const greeting = context.recipientName?.trim()
    ? `Hi ${context.recipientName.trim()},`
    : 'Hi there,';

  const data = (notification.data ?? {}) as Record<string, unknown>;
  const handler = HANDLERS[notification.type as NotificationType];
  const built = handler
    ? handler(notification, data, context, greeting)
    : buildGeneric(notification, greeting);

  const reason = REASON_BY_TYPE[notification.type as NotificationType]
    ?? "You're receiving this because notifications are on for your account.";

  const rendered = renderLayout({
    preheader: notification.body?.slice(0, 140) || notification.title,
    title: built.title,
    intro: built.intro,
    blocks: built.blocks,
    cta: built.cta,
    reason,
    workspaceName: context.workspaceName ?? undefined,
  });

  return { subject: built.subject, ...rendered };
}

// ─────────────────────────────────────────────────────────────────────────────

interface BuiltBody {
  subject: string;
  title: string;
  intro: string;
  blocks: EmailBlock[];
  cta?: { label: string; url: string };
}

type Handler = (
  notif: Notification,
  data: Record<string, unknown>,
  ctx: NotificationEmailContext,
  greeting: string,
) => BuiltBody;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function buildCta(
  ctx: NotificationEmailContext,
  path: string | undefined,
  label: string,
): BuiltBody['cta'] {
  if (!ctx.appBaseUrl || !path) return undefined;
  const base = ctx.appBaseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return { label, url: `${base}${suffix}` };
}

function taskPath(data: Record<string, unknown>): string | undefined {
  const taskId = str(data.taskId);
  return taskId ? `/tasks/${taskId}` : undefined;
}

function projectPath(data: Record<string, unknown>): string | undefined {
  const projectId = str(data.projectId);
  return projectId ? `/projects/${projectId}` : undefined;
}

function buildGeneric(notif: Notification, greeting: string): BuiltBody {
  const blocks: EmailBlock[] = [];
  if (notif.body) blocks.push({ paragraph: notif.body });
  return {
    subject: notif.title || `Jitre — ${notif.type}`,
    title: notif.title || 'New notification',
    intro: `${greeting} you have a new update.`,
    blocks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const HANDLERS: Partial<Record<NotificationType, Handler>> = {
  [NotificationType.TASK_ASSIGNED]: (notif, data, ctx, greeting) => ({
    subject: `New task assigned to you — ${notif.title}`,
    title: 'A task was assigned to you',
    intro: `${greeting} a new task has landed on your plate.`,
    blocks: [
      {
        facts: [
          { label: 'Task', value: notif.title || '(untitled)' },
          ...(str(data.projectId)
            ? [{ label: 'Project', value: str(data.projectId)! }]
            : []),
        ],
      },
      ...(notif.body ? [{ paragraph: notif.body }] : []),
    ],
    cta: buildCta(ctx, taskPath(data), 'Open task'),
  }),

  [NotificationType.TASK_DUE_SOON]: (notif, data, ctx, greeting) => ({
    subject: `Due soon — ${notif.title}`,
    title: 'A task is due soon',
    intro: `${greeting} this one is approaching its due date.`,
    blocks: [
      {
        facts: [
          { label: 'Task', value: notif.title || '(untitled)' },
          ...(str(data.dueDate)
            ? [{ label: 'Due', value: str(data.dueDate)! }]
            : []),
        ],
      },
    ],
    cta: buildCta(ctx, taskPath(data), 'Open task'),
  }),

  [NotificationType.TASK_COMPLETED]: (notif, data, ctx, greeting) => ({
    subject: `Task completed — ${notif.title}`,
    title: 'A task was completed',
    intro: `${greeting} a task you care about was just marked complete.`,
    blocks: [
      {
        facts: [
          { label: 'Task', value: notif.title || '(untitled)' },
          ...(str(data.completedAt)
            ? [{ label: 'Completed at', value: str(data.completedAt)! }]
            : []),
        ],
      },
    ],
    cta: buildCta(ctx, taskPath(data), 'Open task'),
  }),

  [NotificationType.TASK_STATUS_CHANGED]: (notif, data, ctx, greeting) => ({
    subject: `Status changed — ${notif.title}`,
    title: 'A task status changed',
    intro: `${greeting} the status of a task you follow has been updated.`,
    blocks: [
      {
        facts: [
          { label: 'Task', value: notif.title || '(untitled)' },
          ...(str(data.newStatusId)
            ? [{ label: 'New status', value: str(data.newStatusId)! }]
            : []),
        ],
      },
    ],
    cta: buildCta(ctx, taskPath(data), 'Open task'),
  }),

  [NotificationType.TASK_MENTIONED]: (notif, data, ctx, greeting) =>
    buildMention(notif, data, ctx, greeting, 'task'),

  [NotificationType.COMMENT_MENTIONED]: (notif, data, ctx, greeting) =>
    buildMention(notif, data, ctx, greeting, 'comment'),

  [NotificationType.COMMENT_REPLIED]: (notif, data, ctx, greeting) => ({
    subject: `New reply — ${notif.title}`,
    title: 'Someone replied to your comment',
    intro: `${greeting} a reply just landed on a thread you're part of.`,
    blocks: [
      ...(str(data.excerpt) ? [{ quote: str(data.excerpt)! }] : []),
      ...(notif.body ? [{ paragraph: notif.body }] : []),
    ],
    cta: buildCta(ctx, taskPath(data), 'Open thread'),
  }),

  [NotificationType.MENTION]: (notif, data, ctx, greeting) =>
    buildMention(notif, data, ctx, greeting, 'mention'),

  [NotificationType.PROJECT_MEMBER_ADDED]: (notif, data, ctx, greeting) => ({
    subject: `You were added to a project — ${notif.title}`,
    title: 'You were added to a project',
    intro: `${greeting} you now have access to a new project.`,
    blocks: [
      {
        facts: [
          ...(str(data.role) ? [{ label: 'Role', value: str(data.role)! }] : []),
        ],
      },
    ],
    cta: buildCta(ctx, projectPath(data), 'Open project'),
  }),

  [NotificationType.WORKSPACE_INVITED]: (notif, data, ctx, greeting) => ({
    subject: notif.title || 'You were added to a workspace',
    title: 'Welcome aboard',
    intro: `${greeting} you've been added to a workspace.`,
    blocks: [
      {
        facts: [
          ...(str(data.role) ? [{ label: 'Role', value: str(data.role)! }] : []),
        ],
      },
      ...(notif.body ? [{ paragraph: notif.body }] : []),
    ],
    cta: buildCta(ctx, '/', 'Open Jitre'),
  }),

  [NotificationType.WORKSPACE_OWNERSHIP_TRANSFERRED]: (
    notif,
    _data,
    ctx,
    greeting,
  ) => ({
    subject: notif.title || 'Workspace ownership transferred',
    title: 'Workspace ownership transferred to you',
    intro: `${greeting} you're now the owner of this workspace.`,
    blocks: notif.body ? [{ paragraph: notif.body }] : [],
    cta: buildCta(ctx, '/settings/workspace', 'Open workspace settings'),
  }),

  [NotificationType.AI_QUOTA_WARNING]: (notif, _data, ctx, greeting) => ({
    subject: 'Heads up — AI usage approaching daily limit',
    title: 'AI usage is nearing the daily budget',
    intro: `${greeting} the workspace is approaching its AI spend limit for today.`,
    blocks: notif.body
      ? [{ paragraph: notif.body }]
      : [
          {
            paragraph:
              'You can keep using Jitre normally; AI-powered features may be throttled if the budget is exceeded.',
          },
        ],
    cta: buildCta(ctx, '/settings/ai', 'Adjust AI settings'),
  }),

  [NotificationType.AI_BUDGET_EXCEEDED_NOTIFY]: (notif, _data, ctx, greeting) => ({
    subject: 'AI budget exceeded for today',
    title: 'AI daily budget reached',
    intro: `${greeting} the workspace has hit its AI spend cap for today.`,
    blocks: notif.body
      ? [{ paragraph: notif.body }]
      : [
          {
            paragraph:
              'AI-powered features will resume automatically tomorrow, or after an admin raises the daily limit.',
          },
        ],
    cta: buildCta(ctx, '/settings/ai', 'Open AI settings'),
  }),

  [NotificationType.AI_INSIGHT_READY]: (notif, _data, ctx, greeting) => ({
    subject: notif.title || 'A new AI insight is ready',
    title: notif.title || 'A new AI insight is ready',
    intro: `${greeting} Jitre just finished an AI summary for you.`,
    blocks: notif.body ? [{ paragraph: notif.body }] : [],
    cta: buildCta(ctx, '/', 'Open Jitre'),
  }),

  [NotificationType.AUTOMATION_TRIGGERED]: (notif, _data, ctx, greeting) => ({
    subject: notif.title || 'An automation ran on your behalf',
    title: notif.title || 'An automation ran',
    intro: `${greeting} an automation rule just fired in your workspace.`,
    blocks: notif.body ? [{ paragraph: notif.body }] : [],
    cta: buildCta(ctx, '/automations', 'View automations'),
  }),

  [NotificationType.SYSTEM]: (notif, _data, _ctx, greeting) => ({
    subject: notif.title || 'Jitre system update',
    title: notif.title || 'System update',
    intro: `${greeting} you have a message from the Jitre team.`,
    blocks: notif.body ? [{ paragraph: notif.body }] : [],
  }),
};

function buildMention(
  notif: Notification,
  data: Record<string, unknown>,
  ctx: NotificationEmailContext,
  greeting: string,
  surface: 'task' | 'comment' | 'mention',
): BuiltBody {
  const surfaceLabel =
    surface === 'task' ? 'a task' : surface === 'comment' ? 'a comment' : 'something';
  return {
    subject: `You were mentioned — ${notif.title}`,
    title: 'You were mentioned',
    intro: `${greeting} someone tagged you in ${surfaceLabel}.`,
    blocks: [
      ...(str(data.excerpt) ? [{ quote: str(data.excerpt)! }] : []),
      ...(notif.body ? [{ paragraph: notif.body }] : []),
    ],
    cta: buildCta(ctx, taskPath(data), 'Open mention'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const REASON_BY_TYPE: Partial<Record<NotificationType, string>> = {
  [NotificationType.TASK_ASSIGNED]:
    "You're receiving this because 'Task assigned' email notifications are on.",
  [NotificationType.TASK_DUE_SOON]:
    "You're receiving this because 'Task due soon' email notifications are on.",
  [NotificationType.TASK_COMPLETED]:
    "You're receiving this because 'Task completed' email notifications are on.",
  [NotificationType.TASK_STATUS_CHANGED]:
    "You're receiving this because 'Task status changed' email notifications are on.",
  [NotificationType.PROJECT_MEMBER_ADDED]:
    "You're receiving this because 'Project member added' email notifications are on.",
  [NotificationType.AI_QUOTA_WARNING]:
    "You're receiving this because 'AI quota warning' email notifications are on.",
  [NotificationType.AI_BUDGET_EXCEEDED_NOTIFY]:
    "You're receiving this because 'AI quota warning' email notifications are on.",
  [NotificationType.MENTION]:
    "You're receiving this because mentions of you trigger email notifications.",
  [NotificationType.TASK_MENTIONED]:
    "You're receiving this because mentions of you trigger email notifications.",
  [NotificationType.COMMENT_MENTIONED]:
    "You're receiving this because mentions of you trigger email notifications.",
  [NotificationType.COMMENT_REPLIED]:
    "You're receiving this because replies on your threads trigger email notifications.",
  [NotificationType.WORKSPACE_INVITED]:
    "You're receiving this because you were invited to a workspace — invitations always email.",
  [NotificationType.WORKSPACE_OWNERSHIP_TRANSFERRED]:
    'Workspace ownership transfers always email so the new owner is alerted.',
  [NotificationType.SYSTEM]:
    "You're receiving this because it's a system message from the Jitre team.",
};

/**
 * Map a NotificationType to the per-user preference key that gates its
 * email. Types not in this map are not gated by user-level toggles —
 * either they're transactional (workspace invite, ownership transfer)
 * or they fall back to the master `notification.email` switch.
 */
export const NOTIFICATION_TYPE_SETTING_KEY: Partial<
  Record<NotificationType, string>
> = {
  [NotificationType.TASK_ASSIGNED]: 'notification.task_assigned',
  [NotificationType.TASK_DUE_SOON]: 'notification.task_due_soon',
  [NotificationType.TASK_COMPLETED]: 'notification.task_completed',
  [NotificationType.TASK_STATUS_CHANGED]: 'notification.task_status_changed',
  [NotificationType.PROJECT_MEMBER_ADDED]: 'notification.project_member_added',
  [NotificationType.AI_QUOTA_WARNING]: 'notification.ai_quota_warning',
  [NotificationType.AI_BUDGET_EXCEEDED_NOTIFY]: 'notification.ai_quota_warning',
};

/**
 * Types that should always email if the master `notification.email`
 * switch is on, regardless of per-event toggles. Used for transactional
 * messages where dropping the email would lock the user out of the flow.
 */
export const ALWAYS_EMAIL_TYPES: ReadonlySet<NotificationType> = new Set([
  NotificationType.WORKSPACE_INVITED,
  NotificationType.WORKSPACE_OWNERSHIP_TRANSFERRED,
]);
