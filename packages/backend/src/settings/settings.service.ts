import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserSetting } from './user-setting.entity';
import { WorkspaceSetting } from './workspace-setting.entity';
import { AiSetting } from './ai-setting.entity';
import { NotificationSetting } from './notification-setting.entity';
import {
  DEFAULT_VALUES,
  SETTING_SCOPE,
  assertKnownKey,
} from './settings-keys.constants';

export interface MergedUserPreferences {
  notifications: {
    in_app: boolean;
    email: boolean;
    batching_window_minutes: number;
    task_assigned: boolean;
    task_due_soon: boolean;
    task_completed: boolean;
    task_status_changed: boolean;
    project_member_added: boolean;
    ai_quota_warning: boolean;
  };
  ai: {
    'ai.gemini.model': string;
    'ai.gemini.temperature': number;
    'ai.enabled': boolean;
  };
  user: {
    'user.timezone': string;
    'user.locale': string;
    'user.theme': string;
  };
  workspace: {
    'workspace.default_locale': string;
    'workspace.allowed_domains': string[];
    'workspace.invite_only': boolean;
  };
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSetting)
    private readonly userRepo: Repository<UserSetting>,

    @InjectRepository(WorkspaceSetting)
    private readonly workspaceRepo: Repository<WorkspaceSetting>,

    @InjectRepository(AiSetting)
    private readonly aiRepo: Repository<AiSetting>,

    @InjectRepository(NotificationSetting)
    private readonly notificationRepo: Repository<NotificationSetting>,
  ) {}

  // ── User settings ──────────────────────────────────────────────────────────

  async getUserSetting<T = unknown>(userId: string, key: string): Promise<T> {
    assertKnownKey(SETTING_SCOPE.USER, key);
    const row = await this.userRepo.findOne({
      where: { userId, key, deletedAt: IsNull() },
    });
    return (row?.value ?? DEFAULT_VALUES[key]) as T;
  }

  async setUserSetting(
    userId: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    assertKnownKey(SETTING_SCOPE.USER, key);
    // We can't use `repo.upsert(...)` here: the unique index is partial
    // (WHERE deleted_at IS NULL) and Postgres rejects ON CONFLICT against a
    // partial index unless the WHERE clause is replicated exactly, which
    // TypeORM doesn't do. findOne + update/insert preserves the same
    // semantics without that constraint.
    const existing = await this.userRepo.findOne({
      where: { userId, key, deletedAt: IsNull() },
    });
    if (existing) {
      await this.userRepo.update(existing.id, { value });
    } else {
      await this.userRepo.save(this.userRepo.create({ userId, key, value }));
    }
  }

  // ── Workspace settings ─────────────────────────────────────────────────────

  async getWorkspaceSetting<T = unknown>(
    workspaceId: string,
    key: string,
  ): Promise<T> {
    assertKnownKey(SETTING_SCOPE.WORKSPACE, key);
    const row = await this.workspaceRepo.findOne({
      where: { workspaceId, key, deletedAt: IsNull() },
    });
    return (row?.value ?? DEFAULT_VALUES[key]) as T;
  }

  async setWorkspaceSetting(
    workspaceId: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    assertKnownKey(SETTING_SCOPE.WORKSPACE, key);
    this.validateWorkspaceSettingValue(key, value);
    // See note on setUserSetting — partial unique index forces find-then-write.
    const existing = await this.workspaceRepo.findOne({
      where: { workspaceId, key, deletedAt: IsNull() },
    });
    if (existing) {
      await this.workspaceRepo.update(existing.id, { value });
    } else {
      await this.workspaceRepo.save(
        this.workspaceRepo.create({ workspaceId, key, value }),
      );
    }
  }

  /**
   * J2 validators for workspace-scoped settings.
   * Throws BadRequestException on invalid values.
   */
  private validateWorkspaceSettingValue(key: string, value: unknown): void {
    if (key === 'notification.task_due_soon_window_days') {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0) {
        throw new BadRequestException(
          'notification.task_due_soon_window_days must be a positive integer',
        );
      }
    }
  }

  // ── AI settings ────────────────────────────────────────────────────────────

  async getAiSetting<T = unknown>(
    workspaceId: string,
    key: string,
    fallback?: T,
  ): Promise<T> {
    assertKnownKey(SETTING_SCOPE.AI, key);
    const row = await this.aiRepo.findOne({
      where: { workspaceId, key, deletedAt: IsNull() },
    });
    return (row?.value ?? fallback ?? DEFAULT_VALUES[key]) as T;
  }

  async setAiSetting(
    workspaceId: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    assertKnownKey(SETTING_SCOPE.AI, key);
    this.validateAiSettingValue(key, value);
    // See note on setUserSetting — partial unique index forces find-then-write.
    const existing = await this.aiRepo.findOne({
      where: { workspaceId, key, deletedAt: IsNull() },
    });
    if (existing) {
      await this.aiRepo.update(existing.id, { value });
    } else {
      await this.aiRepo.save(
        this.aiRepo.create({ workspaceId, key, value }),
      );
    }
  }

  /**
   * J2 validators for AI-scoped settings.
   */
  private validateAiSettingValue(key: string, value: unknown): void {
    if (key === 'ai.provider' && value !== 'GEMINI') {
      throw new BadRequestException(
        'ai.provider must be GEMINI until another provider is implemented',
      );
    }

    if (key === 'ai.daily_budget_usd') {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException(
          'ai.daily_budget_usd must be a positive number',
        );
      }
    }
  }

  // ── Notification settings (precedence chain) ───────────────────────────────

  /**
   * Resolves a notification setting following the precedence chain:
   *   per-user-per-workspace → per-user-global → workspace → hardcoded default
   */
  async getNotificationSetting(
    userId: string,
    workspaceId: string,
    key: string,
    defaultValue: unknown,
  ): Promise<unknown> {
    // 1. per-user-per-workspace
    const perWorkspace = await this.notificationRepo.findOne({
      where: { userId, workspaceId, key, deletedAt: IsNull() },
    });
    if (perWorkspace) return perWorkspace.value;

    // 2. per-user-global (workspaceId IS NULL)
    const perUserGlobal = await this.notificationRepo.findOne({
      where: {
        userId,
        workspaceId: IsNull() as unknown as string,
        key,
        deletedAt: IsNull(),
      },
    });
    if (perUserGlobal) return perUserGlobal.value;

    // 3. workspace-level
    const workspaceSetting = await this.workspaceRepo.findOne({
      where: { workspaceId, key, deletedAt: IsNull() },
    });
    if (workspaceSetting) return workspaceSetting.value;

    // 4. hardcoded default
    return DEFAULT_VALUES[key] ?? defaultValue;
  }

  async setNotificationSetting(
    userId: string,
    workspaceId: string | null,
    key: string,
    value: unknown,
  ): Promise<void> {
    assertKnownKey(SETTING_SCOPE.NOTIFICATION, key);
    // See note on setUserSetting — partial unique index forces find-then-write.
    // `workspaceId` can be null (per-user-global setting) — handle both cases.
    const existing = await this.notificationRepo.findOne({
      where: {
        userId,
        workspaceId: workspaceId === null ? IsNull() : workspaceId,
        key,
        deletedAt: IsNull(),
      } as Record<string, unknown>,
    });
    if (existing) {
      await this.notificationRepo.update(existing.id, { value });
    } else {
      await this.notificationRepo.save(
        this.notificationRepo.create({ userId, workspaceId, key, value }),
      );
    }
  }

  // ── Merged preferences ─────────────────────────────────────────────────────

  async getMergedUserPreferences(
    userId: string,
    workspaceId: string,
  ): Promise<MergedUserPreferences> {
    const [
      inApp,
      email,
      batchingMin,
      taskAssigned,
      taskDueSoon,
      taskCompleted,
      taskStatusChanged,
      projectMemberAdded,
      aiQuotaWarning,
    ] = await Promise.all([
      this.getNotificationSetting(
        userId,
        workspaceId,
        'notification.in_app',
        true,
      ),
      this.getNotificationSetting(
        userId,
        workspaceId,
        'notification.email',
        true,
      ),
      this.getNotificationSetting(
        userId,
        workspaceId,
        'notification.batching.window_minutes',
        0,
      ),
      this.getNotificationSetting(
        userId,
        workspaceId,
        'notification.task_assigned',
        true,
      ),
      this.getNotificationSetting(
        userId,
        workspaceId,
        'notification.task_due_soon',
        true,
      ),
      this.getNotificationSetting(
        userId,
        workspaceId,
        'notification.task_completed',
        true,
      ),
      this.getNotificationSetting(
        userId,
        workspaceId,
        'notification.task_status_changed',
        true,
      ),
      this.getNotificationSetting(
        userId,
        workspaceId,
        'notification.project_member_added',
        true,
      ),
      this.getNotificationSetting(
        userId,
        workspaceId,
        'notification.ai_quota_warning',
        true,
      ),
    ]);

    const [timezone, locale, theme] = await Promise.all(
      ['user.timezone', 'user.locale', 'user.theme'].map((k) =>
        this.getUserSetting<string>(userId, k).catch(
          () => DEFAULT_VALUES[k] as string,
        ),
      ),
    );

    const [aiModel, aiTemp, aiEnabled] = await Promise.all(
      ['ai.gemini.model', 'ai.gemini.temperature', 'ai.enabled'].map((k) =>
        this.getAiSetting<unknown>(workspaceId, k).catch(
          () => DEFAULT_VALUES[k],
        ),
      ),
    );

    const [defaultLocale, allowedDomains, inviteOnly] = await Promise.all(
      [
        'workspace.default_locale',
        'workspace.allowed_domains',
        'workspace.invite_only',
      ].map((k) =>
        this.getWorkspaceSetting<unknown>(workspaceId, k).catch(
          () => DEFAULT_VALUES[k],
        ),
      ),
    );

    return {
      notifications: {
        in_app: inApp as boolean,
        email: email as boolean,
        batching_window_minutes: batchingMin as number,
        task_assigned: taskAssigned as boolean,
        task_due_soon: taskDueSoon as boolean,
        task_completed: taskCompleted as boolean,
        task_status_changed: taskStatusChanged as boolean,
        project_member_added: projectMemberAdded as boolean,
        ai_quota_warning: aiQuotaWarning as boolean,
      },
      ai: {
        'ai.gemini.model': aiModel as string,
        'ai.gemini.temperature': aiTemp as number,
        'ai.enabled': aiEnabled as boolean,
      },
      user: {
        'user.timezone': timezone,
        'user.locale': locale,
        'user.theme': theme,
      },
      workspace: {
        'workspace.default_locale': defaultLocale as string,
        'workspace.allowed_domains': allowedDomains as string[],
        'workspace.invite_only': inviteOnly as boolean,
      },
    };
  }
}
