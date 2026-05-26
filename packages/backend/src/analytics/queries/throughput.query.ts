import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  TimeBucketHelper,
  type AnalyticsPeriod,
} from '../helpers/time-bucket.helper';
import { DateRangeHelper } from '../helpers/date-range.helper';
import type { TimeSeriesPointDto } from '../dto';

export interface ThroughputInput {
  workspaceId: string;
  period: AnalyticsPeriod;
  from: string;
  to: string;
  projectId?: string;
}

@Injectable()
export class ThroughputQuery {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async execute(input: ThroughputInput): Promise<TimeSeriesPointDto[]> {
    const { workspaceId, period, from, to, projectId } = input;

    const rows = await this.ds
      .createQueryBuilder()
      .select(
        `to_char(${TimeBucketHelper.dateTruncExpr(period, 'al.occurred_at')}, '${TimeBucketHelper.formatForPeriod(period)}')`,
        'bucket',
      )
      .addSelect('COUNT(*)::int', 'value')
      .from('audit_logs', 'al')
      .where('al.workspace_id = :workspaceId', { workspaceId })
      .andWhere(`al.action = 'TASK_STATUS_CHANGED'`)
      .andWhere(`al.diff @> jsonb_build_object('newCategory', 'done')`)
      .andWhere('al.occurred_at >= :from AND al.occurred_at < :to', {
        from,
        to,
      })
      .andWhere('al.deleted_at IS NULL')
      .andWhere(
        projectId
          ? 'al.subject_id IN (SELECT id FROM tasks WHERE project_id = :projectId)'
          : '1=1',
        { projectId },
      )
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: string; value: string }>();

    return this.gapFill(rows, period, from, to);
  }

  private gapFill(
    rows: { bucket: string; value: string }[],
    period: AnalyticsPeriod,
    from: string,
    to: string,
  ): TimeSeriesPointDto[] {
    const map = new Map(rows.map((r) => [r.bucket, parseInt(r.value, 10)]));
    const result: TimeSeriesPointDto[] = [];
    let current = TimeBucketHelper.bucketStart(
      period,
      DateRangeHelper.toDate(from),
    );
    const end = DateRangeHelper.toDate(to);

    while (current < end) {
      const label = this.formatLabel(current, period);
      result.push({ period: label, value: map.get(label) ?? 0 });
      current = this.advance(current, period);
    }
    return result;
  }

  private formatLabel(date: Date, period: AnalyticsPeriod): string {
    if (period === 'day') return date.toISOString().slice(0, 10);
    if (period === 'month')
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return this.toIsoWeek(date);
  }

  private toIsoWeek(date: Date): string {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  private advance(date: Date, period: AnalyticsPeriod): Date {
    const d = new Date(date);
    if (period === 'day') d.setUTCDate(d.getUTCDate() + 1);
    else if (period === 'week') d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }
}
