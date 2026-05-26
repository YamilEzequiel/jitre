import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditAction } from '@jitre/shared';
import { DomainEvent } from '../events/domain-event.base';
import { RequestContextService } from '../request-context/request-context.service';
import { AuditLogService } from './audit-log.service';
import { scrubSensitive } from './scrub-sensitive.util';

const ACTION_MAP: Record<string, AuditAction> = {
  'user.registered': AuditAction.USER_REGISTERED,
  'user.disabled': AuditAction.USER_DISABLED,
  'workspace.created': AuditAction.WORKSPACE_CREATED,
  'workspace.member.added': AuditAction.WORKSPACE_MEMBER_ADDED,
  'workspace.member.removed': AuditAction.WORKSPACE_MEMBER_REMOVED,
  'workspace.ownership.transferred':
    AuditAction.WORKSPACE_OWNERSHIP_TRANSFERRED,
  'mention.created': AuditAction.MENTION_CREATED,
  'session.created': AuditAction.SESSION_CREATED,
  'session.revoked': AuditAction.SESSION_REVOKED,
  'comment.created': AuditAction.COMMENT_CREATED,
  'comment.updated': AuditAction.COMMENT_UPDATED,
  'comment.deleted': AuditAction.COMMENT_DELETED,
  'attachment.uploaded': AuditAction.ATTACHMENT_UPLOADED,
  'attachment.deleted': AuditAction.ATTACHMENT_DELETED,
  'task.status_changed': AuditAction.TASK_STATUS_CHANGED,
};

@Injectable()
export class AuditLogListener {
  private readonly logger = new Logger(AuditLogListener.name);

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly requestContext: RequestContextService,
  ) {}

  @OnEvent('**', { suppressErrors: false })
  async handleEvent(event: DomainEvent): Promise<void> {
    if (!(event instanceof DomainEvent) || !event.workspaceId) {
      return;
    }

    const action = ACTION_MAP[event.name];
    if (!action) {
      this.logger.warn(
        { eventName: event.name },
        'No audit action mapping for event — skipping',
      );
      return;
    }

    try {
      const diff = scrubSensitive(event.payload) as Record<string, unknown>;
      const summary = `${event.actorUserId ?? 'system'} ${event.name}`;

      await this.auditLogService.append({
        workspaceId: event.workspaceId,
        actorUserId: event.actorUserId,
        action,
        subjectType: event.aggregateType,
        subjectId: event.aggregateId,
        summary,
        diff,
        occurredAt: event.occurredAt,
        requestId: this.requestContext.getRequestId() ?? undefined,
        eventId: event.eventId,
      });
    } catch (err) {
      this.logger.error(
        { eventId: event.eventId, eventName: event.name, err },
        'AuditLogListener failed',
      );
    }
  }
}
