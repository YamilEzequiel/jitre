import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  TimeBucketHelper,
  type AnalyticsPeriod,
} from '../helpers/time-bucket.helper';
import { PercentileHelper } from '../helpers/percentile.helper';
import type { DurationStatsDto } from '../dto';

export interface LeadTimeInput {
  workspaceId: string;
  period: AnalyticsPeriod;
  from: string;
  to: string;
  projectId?: string;
}

@Injectable()
export class LeadTimeQuery {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async execute(input: LeadTimeInput): Promise<DurationStatsDto[]> {
    const { workspaceId, period, from, to, projectId } = input;
    const durExpr = `EXTRACT(EPOCH FROM (t.completed_at - t.created_at))::float`;

    const rows = await this.ds
      .createQueryBuilder()
      .select(
        `to_char(${TimeBucketHelper.dateTruncExpr(period, 't.completed_at')}, '${TimeBucketHelper.formatForPeriod(period)}')`,
        'period',
      )
      .addSelect(PercentileHelper.expr(0.5, durExpr), 'p50')
      .addSelect(PercentileHelper.expr(0.75, durExpr), 'p75')
      .addSelect(PercentileHelper.expr(0.95, durExpr), 'p95')
      .addSelect(`AVG(${durExpr})`, 'mean')
      .addSelect('COUNT(*)::int', 'count')
      .from('tasks', 't')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.completed_at IS NOT NULL')
      .andWhere('t.completed_at >= :from AND t.completed_at < :to', {
        from,
        to,
      })
      .andWhere('t.deleted_at IS NULL')
      .andWhere(
        projectId ? 't.project_id = :projectId' : '1=1',
        projectId ? { projectId } : {},
      )
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{
        period: string;
        p50: string;
        p75: string;
        p95: string;
        mean: string;
        count: string;
      }>();

    return rows.map((r) => ({
      period: r.period,
      p50: parseFloat(r.p50) || 0,
      p75: parseFloat(r.p75) || 0,
      p95: parseFloat(r.p95) || 0,
      mean: parseFloat(r.mean) || 0,
      count: parseInt(r.count, 10),
    }));
  }
}
