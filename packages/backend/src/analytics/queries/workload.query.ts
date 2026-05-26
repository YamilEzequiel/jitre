import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { WorkloadBucketDto } from '../dto';

export interface WorkloadInput {
  workspaceId: string;
  groupBy: 'assignee' | 'status';
  projectId?: string;
}

@Injectable()
export class WorkloadQuery {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async execute(input: WorkloadInput): Promise<WorkloadBucketDto[]> {
    const { workspaceId, groupBy, projectId } = input;

    let rows: { key: string; count: string }[];

    if (groupBy === 'assignee') {
      rows = await this.ds
        .createQueryBuilder()
        .select(`COALESCE(ta.user_id::text, '__unassigned__')`, 'key')
        .addSelect('COUNT(DISTINCT t.id)::int', 'count')
        .from('tasks', 't')
        .leftJoin(
          'task_assignments',
          'ta',
          'ta.task_id = t.id AND ta.deleted_at IS NULL',
        )
        .where('t.workspace_id = :workspaceId', { workspaceId })
        .andWhere('t.deleted_at IS NULL')
        .andWhere(
          `EXISTS (
          SELECT 1 FROM statuses ts
          WHERE ts.id = t.status_id AND ts.category <> :doneCategory
        ) OR t.status_id IS NULL`,
          { doneCategory: 'done' },
        )
        .andWhere(projectId ? 't.project_id = :projectId' : '1=1', {
          projectId,
        })
        .groupBy('key')
        .orderBy('count', 'DESC')
        .addOrderBy('key', 'ASC')
        .getRawMany<{ key: string; count: string }>();
    } else {
      rows = await this.ds
        .createQueryBuilder()
        .select('ts.id::text', 'key')
        .addSelect('COUNT(DISTINCT t.id)::int', 'count')
        .from('tasks', 't')
        .innerJoin('statuses', 'ts', 'ts.id = t.status_id')
        .where('t.workspace_id = :workspaceId', { workspaceId })
        .andWhere('t.deleted_at IS NULL')
        .andWhere(projectId ? 't.project_id = :projectId' : '1=1', {
          projectId,
        })
        .groupBy('ts.id')
        .orderBy('count', 'DESC')
        .getRawMany<{ key: string; count: string }>();
    }

    return rows.map((r) => ({ key: r.key, count: parseInt(r.count, 10) }));
  }
}
