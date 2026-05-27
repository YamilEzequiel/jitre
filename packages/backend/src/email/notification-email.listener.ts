import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NotificationType } from '@jitre/shared';
import { Notification } from '../notification/notification.entity';
import { UserEntity } from '../user/user.entity';
import { EmailService } from './email.service';
import { NotificationCreatedPayload } from '../notification/events/notification-created.event';

/**
 * Bridges in-app notifications to email.
 *
 * Hook order:
 * 1. Listen on `notification.created` — same event that the realtime WS uses.
 * 2. Load the recipient user; consult their per-type email preferences
 *    (email_mentions / email_assignments / email_due_dates).
 * 3. Render a minimal subject + body from the stored notification row.
 * 4. Mark `email_sent_at` on the notification row so we never double-send and
 *    the audit log shows which path the notification took.
 *
 * EmailService is best-effort and never throws upward; this listener mirrors
 * that — a misconfigured SMTP must not impact the request that created the
 * notification.
 */
@Injectable()
export class NotificationEmailListener {
  private readonly logger = new Logger(NotificationEmailListener.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly email: EmailService,
  ) {}

  @OnEvent('notification.created')
  async onCreated(event: {
    workspaceId: string;
    payload: NotificationCreatedPayload;
  }): Promise<void> {
    try {
      const id = event.payload?.notificationId;
      const recipientId = event.payload?.recipientUserId;
      if (!id || !recipientId) return;

      const notif = await this.notifRepo.findOne({
        where: { id, deletedAt: IsNull() } as Record<string, unknown>,
      });
      if (!notif || notif.emailSentAt) return; // already sent / not found

      const user = await this.userRepo.findOne({ where: { id: recipientId } });
      if (!user || !user.email) return;
      if (!this.userAllowsEmailFor(user, notif.type as NotificationType)) {
        return;
      }

      const subject = this.subjectFor(notif);
      const body = this.bodyFor(notif);
      await this.email.send({ to: user.email, subject, text: body });

      await this.notifRepo.update(notif.id, { emailSentAt: new Date() });
    } catch (err) {
      this.logger.warn(
        `notification-email failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Maps notification type to the per-user opt-out flag.
   *
   * Default = true (opt-out). Unknown types pass through — we'd rather over-
   * notify than silently drop a new category until someone adds a flag.
   */
  private userAllowsEmailFor(user: UserEntity, type: NotificationType): boolean {
    if (this.isMention(type)) return user.emailMentions !== false;
    if (this.isAssignment(type)) return user.emailAssignments !== false;
    if (this.isDueDate(type)) return user.emailDueDates !== false;
    return true;
  }

  private isMention(type: NotificationType): boolean {
    return (
      type === NotificationType.TASK_MENTIONED ||
      type === NotificationType.MENTION ||
      type === NotificationType.COMMENT_MENTIONED ||
      type === NotificationType.COMMENT_REPLIED
    );
  }

  private isAssignment(type: NotificationType): boolean {
    return type === NotificationType.TASK_ASSIGNED;
  }

  private isDueDate(type: NotificationType): boolean {
    return type === NotificationType.TASK_DUE_SOON;
  }

  private subjectFor(notif: Notification): string {
    return notif.title || `Jitre — ${notif.type}`;
  }

  private bodyFor(notif: Notification): string {
    const parts: string[] = [];
    if (notif.title) parts.push(notif.title);
    if (notif.body) parts.push('', notif.body);
    parts.push('', '— Jitre');
    return parts.join('\n');
  }
}
