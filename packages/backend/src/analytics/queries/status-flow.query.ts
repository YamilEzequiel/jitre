import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { StatusFlowEdgeDto } from '../dto';

export interface StatusFlowInput {
  workspaceId: string;
  projectId: string;
  from: string;
  to: string;
}

const LIMIT = 1000;

@Injectable()
export class StatusFlowQuery {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async execute(input: StatusFlowInput): Promise<StatusFlowEdgeDto[]> {
    const { edges } = await this.executeWithMeta(input);
    return edges;
  }

  async executeWithMeta(
    input: StatusFlowInput,
  ): Promise<{ edges: StatusFlowEdgeDto[]; isLimitHit: boolean }> {
    const { workspaceId, projectId, from, to } = input;

    const rows = await this.ds
      .createQueryBuilder()
      .select(`(al.diff->>'previousStatusId')::uuid`, 'from_status_id')
      .addSelect(`(al.diff->>'newStatusId')::uuid`, 'to_status_id')
      .addSelect('COUNT(*)::int', 'count')
      .from('audit_logs', 'al')
      .where('al.workspace_id = :workspaceId', { workspaceId })
      .andWhere(`al.action = 'TASK_STATUS_CHANGED'`)
      .andWhere('al.occurred_at >= :from AND al.occurred_at < :to', {
        from,
        to,
      })
      .andWhere(
        'al.subject_id IN (SELECT id FROM tasks WHERE project_id = :projectId)',
        { projectId },
      )
      .andWhere('al.deleted_at IS NULL')
      .andWhere(`al.diff ? 'previousStatusId'`)
      .andWhere(`al.diff ? 'newStatusId'`)
      .groupBy('from_status_id, to_status_id')
      .having('COUNT(*) > 0')
      .orderBy('count', 'DESC')
      .limit(LIMIT)
      .getRawMany<{
        from_status_id: string;
        to_status_id: string;
        count: string;
      }>();

    const edges = rows.map((r) => ({
      fromStatusId: r.from_status_id,
      toStatusId: r.to_status_id,
      count: parseInt(r.count, 10),
    }));

    return { edges, isLimitHit: rows.length >= LIMIT };
  }
}
