import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  TimeBucketHelper,
  type AnalyticsPeriod,
} from '../helpers/time-bucket.helper';
import { DateRangeHelper } from '../helpers/date-range.helper';
import type { AiFailureRatePointDto } from '../dto';

export interface AiUsageFailureRateInput {
  workspaceId: string;
  period: AnalyticsPeriod;
  from: string;
  to: string;
}

@Injectable()
export class AiUsageFailureRateQuery {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async execute(
    input: AiUsageFailureRateInput,
  ): Promise<AiFailureRatePointDto[]> {
    const { workspaceId, period, from, to } = input;

    const rows = await this.ds
      .createQueryBuilder()
      .select(
        `to_char(${TimeBucketHelper.dateTruncExpr(period, 'r.created_at')}, '${TimeBucketHelper.formatForPeriod(period)}')`,
        'bucket',
      )
      .addSelect('COUNT(*)::int', 'total')
      .addSelect(
        `SUM(CASE WHEN r.success = false THEN 1 ELSE 0 END)::int`,
        'failures',
      )
      .from('ai_usage_records', 'r')
      .where('r.workspace_id = :workspaceId', { workspaceId })
      .andWhere('r.created_at >= :from AND r.created_at < :to', { from, to })
      .andWhere('r.deleted_at IS NULL')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: string; total: string; failures: string }>();

    return this.gapFill(rows, period, from, to);
  }

  private gapFill(
    rows: { bucket: string; total: string; failures: string }[],
    period: AnalyticsPeriod,
    from: string,
    to: string,
  ): AiFailureRatePointDto[] {
    const map = new Map(
      rows.map((r) => [
        r.bucket,
        {
          total: parseInt(r.total, 10),
          failures: parseInt(r.failures, 10),
        },
      ]),
    );

    const result: AiFailureRatePointDto[] = [];
    let current = TimeBucketHelper.bucketStart(
      period,
      DateRangeHelper.toDate(from),
    );
    const end = DateRangeHelper.toDate(to);

    while (current < end) {
      const label = this.formatLabel(current, period);
      const entry = map.get(label);
      const total = entry?.total ?? 0;
      const failures = entry?.failures ?? 0;
      result.push({
        period: label,
        total,
        failures,
        failureRate: total === 0 ? 0 : failures / total,
      });
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
