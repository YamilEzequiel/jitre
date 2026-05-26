import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AuditAction } from '@jitre/shared';
import { AuditLog } from './audit-log.entity';

export interface AuditLogInput {
  workspaceId: string;
  actorUserId?: string;
  action: AuditAction;
  subjectType: string;
  subjectId: string;
  summary: string;
  diff: Record<string, unknown>;
  occurredAt: Date;
  requestId?: string;
  eventId: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async append(input: AuditLogInput): Promise<AuditLog> {
    const entity = this.repo.create({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      summary: input.summary,
      diff: input.diff,
      occurredAt: input.occurredAt,
      requestId: input.requestId ?? null,
      eventId: input.eventId,
    });

    try {
      return await this.repo.save(entity);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code: string }).code === '23505'
      ) {
        const existing = await this.repo.findOne({
          where: { eventId: input.eventId },
        });
        return existing!;
      }
      throw err;
    }
  }

  async findByWorkspace(
    workspaceId: string,
    paging: { page: number; pageSize: number },
  ): Promise<Page<AuditLog>> {
    const [items, total] = await this.repo.findAndCount({
      where: { workspaceId },
      order: { occurredAt: 'DESC' },
      skip: (paging.page - 1) * paging.pageSize,
      take: paging.pageSize,
    });
    return { items, total, page: paging.page, pageSize: paging.pageSize };
  }

  async findBySubject(
    workspaceId: string,
    subjectType: string,
    subjectId: string,
    paging: { page: number; pageSize: number },
  ): Promise<Page<AuditLog>> {
    const [items, total] = await this.repo.findAndCount({
      where: { workspaceId, subjectType, subjectId },
      order: { occurredAt: 'DESC' },
      skip: (paging.page - 1) * paging.pageSize,
      take: paging.pageSize,
    });
    return { items, total, page: paging.page, pageSize: paging.pageSize };
  }
}
