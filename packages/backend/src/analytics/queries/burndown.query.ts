import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { BurndownPointDto } from '../dto';

export interface BurndownInput {
  workspaceId: string;
  projectId: string;
  from: string;
  to: string;
  endOfDay?: boolean;
}

@Injectable()
export class BurndownQuery {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async execute(input: BurndownInput): Promise<BurndownPointDto[]> {
    const { workspaceId, projectId, from, to } = input;

    const rows = await this.ds
      .createQueryBuilder()
      .select(`to_char(s.d, 'YYYY-MM-DD')`, 'date')
      .addSelect(
        `(SELECT COUNT(*)::int FROM tasks t
          WHERE t.workspace_id = :workspaceId
            AND t.project_id = :projectId
            AND t.deleted_at IS NULL
            AND t.created_at::date <= s.d
            AND (t.completed_at IS NULL OR t.completed_at::date > s.d))`,
        'remaining',
      )
      .from(
        `generate_series(:from::date, (:to::date - INTERVAL '1 day'), INTERVAL '1 day')`,
        's(d)',
      )
      .where('1=1', { workspaceId, projectId, from, to })
      .orderBy('s.d', 'ASC')
      .getRawMany<{ date: string; remaining: string }>()
      .catch(() => []);

    if (rows.length === 0) {
      return this.gapFill(from, to);
    }

    return rows.map((r) => ({
      date: r.date,
      remaining: parseInt(r.remaining as unknown as string, 10),
    }));
  }

  private gapFill(from: string, to: string): BurndownPointDto[] {
    const result: BurndownPointDto[] = [];
    const current = new Date(from);
    const end = new Date(to);
    while (current < end) {
      result.push({ date: current.toISOString().slice(0, 10), remaining: 0 });
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return result;
  }
}
