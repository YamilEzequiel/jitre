import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { IsNull, Repository } from 'typeorm';
import { NotificationType } from '@jitre/shared';
import { Notification } from '../notification/notification.entity';
import { UserEntity } from '../user/user.entity';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { EmailService } from './email.service';
import { NotificationCreatedPayload } from '../notification/events/notification-created.event';
import { SettingsService } from '../settings/settings.service';
import {
  ALWAYS_EMAIL_TYPES,
  buildEmailForNotification,
  NOTIFICATION_TYPE_SETTING_KEY,
} from './templates/notification-email.template';

/**
 * Bridges in-app notifications to email.
 *
 * Pipeline:
 *   1. Listen on `notification.created` (fired after the row is persisted).
 *   2. Resolve `notification.email` master + per-type toggle via the
 *      Settings service — the same toggles the user sees in /settings/me.
 *   3. Render html + text using the layout + per-type templates.
 *   4. Mark `email_sent_at` so retries don't re-send.
 *
 * Failures are swallowed: a misconfigured SMTP or unknown type must not
 * cascade into the request that produced the notification.
 */
@Injectable()
export class NotificationEmailListener {
  private readonly logger = new Logger(NotificationEmailListener.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    private readonly email: EmailService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent('notification.created')
  async onCreated(event: {
    workspaceId: string;
    payload: NotificationCreatedPayload;
  }): Promise<void> {
    try {
      const id = event.payload?.notificationId;
      const recipientId = event.payload?.recipientUserId;
      const workspaceId = event.workspaceId;
      if (!id || !recipientId || !workspaceId) return;

      const notif = await this.notifRepo.findOne({
        where: { id, deletedAt: IsNull() } as Record<string, unknown>,
      });
      if (!notif || notif.emailSentAt) return;

      const user = await this.userRepo.findOne({ where: { id: recipientId } });
      if (!user || !user.email) return;

      const allowed = await this.shouldEmail(
        recipientId,
        workspaceId,
        notif.type as NotificationType,
      );
      if (!allowed) return;

      const workspace = await this.workspaceRepo
        .findOne({ where: { id: workspaceId } })
        .catch(() => null);

      const { subject, html, text } = buildEmailForNotification(notif, {
        recipientName: user.displayName,
        workspaceName: workspace?.name,
        appBaseUrl:
          this.config.get<string>('APP_URL') ?? process.env.APP_URL ?? null,
      });

      await this.email.send({ to: user.email, subject, html, text });
      await this.notifRepo.update(notif.id, { emailSentAt: new Date() });
    } catch (err) {
      this.logger.warn(
        `notification-email failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Gates an email send against the user's notification settings.
   *
   * Precedence:
   *   1. `notification.email` master switch — if off, drop.
   *   2. Transactional types in `ALWAYS_EMAIL_TYPES` bypass per-event toggles.
   *   3. Per-type setting key from NOTIFICATION_TYPE_SETTING_KEY — if off, drop.
   *   4. Types with no mapping fall through and email.
   */
  private async shouldEmail(
    userId: string,
    workspaceId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const master = await this.settings.getNotificationSetting(
      userId,
      workspaceId,
      'notification.email',
      true,
    );
    if (master === false) return false;

    if (ALWAYS_EMAIL_TYPES.has(type)) return true;

    const key = NOTIFICATION_TYPE_SETTING_KEY[type];
    if (!key) return true;

    const perType = await this.settings.getNotificationSetting(
      userId,
      workspaceId,
      key,
      true,
    );
    return perType !== false;
  }
}
