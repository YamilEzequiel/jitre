import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AiUsageByUserDto } from '../dto';

export interface AiUsageByUserInput {
  workspaceId: string;
  from: string;
  to: string;
}

@Injectable()
export class AiUsageByUserQuery {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async execute(input: AiUsageByUserInput): Promise<AiUsageByUserDto[]> {
    const { workspaceId, from, to } = input;

    const rows = await this.ds
      .createQueryBuilder()
      .select('r.user_id::text', 'user_id')
      .addSelect('COUNT(*)::int', 'requests')
      .addSelect('SUM(r.cost_usd)::text', 'cost_usd')
      .from('ai_usage_records', 'r')
      .where('r.workspace_id = :workspaceId', { workspaceId })
      .andWhere('r.created_at >= :from AND r.created_at < :to', { from, to })
      .andWhere('r.deleted_at IS NULL')
      .groupBy('r.user_id')
      .orderBy('SUM(r.cost_usd)', 'DESC')
      .limit(20)
      .getRawMany<{ user_id: string; requests: string; cost_usd: string }>();

    return rows.map((r) => ({
      userId: r.user_id,
      requests: parseInt(r.requests, 10),
      costUsd: r.cost_usd ?? '0.000000',
    }));
  }
}
