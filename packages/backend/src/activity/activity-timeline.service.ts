import { Injectable } from '@nestjs/common';
import { AuditAction } from '@jitre/shared';
import { AuditLogService, Page } from '../audit/audit-log.service';
import type { AuditLog } from '../audit/audit-log.entity';

export interface ActivityItem {
  id: string;
  action: AuditAction;
  subjectType: string;
  subjectId: string;
  actorUserId?: string;
  summary: string;
  occurredAt: Date;
  diff: Record<string, unknown>;
}

function mapToActivityItem(log: AuditLog): ActivityItem {
  return {
    id: log.id,
    action: log.action,
    subjectType: log.subjectType,
    subjectId: log.subjectId,
    actorUserId: log.actorUserId ?? undefined,
    summary: log.summary,
    occurredAt: log.occurredAt,
    diff: log.diff,
  };
}

@Injectable()
export class ActivityTimelineService {
  constructor(private readonly auditLogService: AuditLogService) {}

  async list(
    workspaceId: string,
    paging: { page: number; pageSize: number },
  ): Promise<Page<ActivityItem>> {
    const result = await this.auditLogService.findByWorkspace(
      workspaceId,
      paging,
    );
    return {
      ...result,
      items: result.items.map(mapToActivityItem),
    };
  }

  async listForSubject(
    workspaceId: string,
    subjectType: string,
    subjectId: string,
    paging: { page: number; pageSize: number },
  ): Promise<Page<ActivityItem>> {
    const result = await this.auditLogService.findBySubject(
      workspaceId,
      subjectType,
      subjectId,
      paging,
    );
    return {
      ...result,
      items: result.items.map(mapToActivityItem),
    };
  }
}
