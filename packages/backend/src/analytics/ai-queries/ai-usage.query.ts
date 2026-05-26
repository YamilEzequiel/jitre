import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  TimeBucketHelper,
  type AnalyticsPeriod,
} from '../helpers/time-bucket.helper';
import { DateRangeHelper } from '../helpers/date-range.helper';
import type { AiUsagePointDto } from '../dto';

export interface AiUsageInput {
  workspaceId: string;
  period: AnalyticsPeriod;
  from: string;
  to: string;
}

@Injectable()
export class AiUsageQuery {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async execute(input: AiUsageInput): Promise<AiUsagePointDto[]> {
    const { workspaceId, period, from, to } = input;

    const rows = await this.ds
      .createQueryBuilder()
      .select(
        `to_char(${TimeBucketHelper.dateTruncExpr(period, 'r.created_at')}, '${TimeBucketHelper.formatForPeriod(period)}')`,
        'bucket',
      )
      .addSelect('COUNT(*)::int', 'requests')
      .addSelect('SUM(r.cost_usd)', 'cost_usd')
      .addSelect('SUM(r.total_tokens)::int', 'total_tokens')
      .from('ai_usage_records', 'r')
      .where('r.workspace_id = :workspaceId', { workspaceId })
      .andWhere('r.created_at >= :from AND r.created_at < :to', { from, to })
      .andWhere('r.deleted_at IS NULL')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{
        bucket: string;
        requests: string;
        cost_usd: string;
        total_tokens: string;
      }>();

    return this.gapFill(rows, period, from, to);
  }

  private gapFill(
    rows: {
      bucket: string;
      requests: string;
      cost_usd: string | null;
      total_tokens: string;
    }[],
    period: AnalyticsPeriod,
    from: string,
    to: string,
  ): AiUsagePointDto[] {
    const map = new Map(
      rows.map((r) => [
        r.bucket,
        {
          requests: parseInt(r.requests, 10),
          costUsd: r.cost_usd ?? '0.000000',
          totalTokens: parseInt(r.total_tokens, 10),
        },
      ]),
    );

    const result: AiUsagePointDto[] = [];
    let current = TimeBucketHelper.bucketStart(
      period,
      DateRangeHelper.toDate(from),
    );
    const end = DateRangeHelper.toDate(to);

    while (current < end) {
      const label = this.formatLabel(current, period);
      const entry = map.get(label);
      result.push({
        period: label,
        requests: entry?.requests ?? 0,
        costUsd: entry?.costUsd ?? '0.000000',
        totalTokens: entry?.totalTokens ?? 0,
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
