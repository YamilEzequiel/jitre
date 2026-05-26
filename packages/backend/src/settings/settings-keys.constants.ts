import { BadRequestException } from '@nestjs/common';

export const SETTING_SCOPE = {
  USER: 'user',
  WORKSPACE: 'workspace',
  AI: 'ai',
  NOTIFICATION: 'notification',
} as const;

export type SettingScope = (typeof SETTING_SCOPE)[keyof typeof SETTING_SCOPE];

export const KNOWN_KEYS = {
  user: ['user.timezone', 'user.locale', 'user.theme'],
  workspace: [
    'workspace.default_locale',
    'workspace.allowed_domains',
    'workspace.invite_only',
    'notification.task_due_soon_window_days',
    // Fase 8 — Analytics
    'analytics.default_period',
  ],
  ai: [
    'ai.gemini.model',
    'ai.gemini.temperature',
    'ai.enabled',
    // Fase 7
    'ai.provider',
    'ai.task_describe_enabled',
    'ai.subtask_suggest_enabled',
    'ai.comment_summary_enabled',
    'ai.daily_budget_usd',
  ],
  notification: [
    'notification.in_app',
    'notification.email',
    'notification.batching.window_minutes',
    'notification.task_assigned',
    'notification.task_due_soon',
    'notification.task_completed',
    'notification.task_status_changed',
    'notification.project_member_added',
    // Fase 7
    'notification.ai_quota_warning',
  ],
} as const satisfies Record<SettingScope, readonly string[]>;

export const KNOWN_KEYS_FLAT: string[] = [
  ...KNOWN_KEYS.user,
  ...KNOWN_KEYS.workspace,
  ...KNOWN_KEYS.ai,
  ...KNOWN_KEYS.notification,
];

export const DEFAULT_VALUES: Record<string, unknown> = {
  'user.timezone': 'UTC',
  'user.locale': 'en',
  'user.theme': 'system',
  'workspace.default_locale': 'en',
  'workspace.allowed_domains': [],
  'workspace.invite_only': false,
  // Fase 8 — Analytics
  'analytics.default_period': 'week',
  'ai.gemini.model': 'gemini-1.5-pro',
  'ai.gemini.temperature': 0.7,
  'ai.enabled': false,
  // Fase 7
  'ai.provider': 'GEMINI',
  'ai.task_describe_enabled': true,
  'ai.subtask_suggest_enabled': true,
  'ai.comment_summary_enabled': true,
  'ai.daily_budget_usd': 5.0,
  'notification.ai_quota_warning': true,
  'notification.in_app': true,
  'notification.email': true,
  'notification.batching.window_minutes': 0,
  'notification.task_assigned': true,
  'notification.task_due_soon': true,
  'notification.task_completed': true,
  'notification.task_status_changed': true,
  'notification.project_member_added': true,
  'notification.task_due_soon_window_days': 3,
};

/** Keys that require OWNER role to mutate (sub-set of workspace.*). */
export const OWNER_ONLY_KEYS = new Set(['workspace.invite_only']);

/**
 * Validates that key belongs to the given scope.
 * Throws BadRequestException('unknown_setting_key') for unknown keys.
 */
export function assertKnownKey(scope: SettingScope, key: string): void {
  const allowed = KNOWN_KEYS[scope] as readonly string[];
  if (!allowed.includes(key)) {
    throw new BadRequestException('unknown_setting_key');
  }
}
