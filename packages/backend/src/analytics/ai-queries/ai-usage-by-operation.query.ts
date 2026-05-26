import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AiUsageByOperationDto } from '../dto';

export interface AiUsageByOperationInput {
  workspaceId: string;
  from: string;
  to: string;
}

@Injectable()
export class AiUsageByOperationQuery {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async execute(
    input: AiUsageByOperationInput,
  ): Promise<AiUsageByOperationDto[]> {
    const { workspaceId, from, to } = input;

    const rows = await this.ds
      .createQueryBuilder()
      .select('r.operation', 'operation')
      .addSelect('COUNT(*)::int', 'requests')
      .addSelect('SUM(r.cost_usd)::text', 'cost_usd')
      .addSelect('AVG(r.latency_ms)::int', 'avg_latency_ms')
      .from('ai_usage_records', 'r')
      .where('r.workspace_id = :workspaceId', { workspaceId })
      .andWhere('r.created_at >= :from AND r.created_at < :to', { from, to })
      .andWhere('r.deleted_at IS NULL')
      .groupBy('r.operation')
      .orderBy('SUM(r.cost_usd)', 'DESC')
      .getRawMany<{
        operation: string;
        requests: string;
        cost_usd: string;
        avg_latency_ms: string;
      }>();

    return rows.map((r) => ({
      operation: r.operation,
      requests: parseInt(r.requests, 10),
      costUsd: r.cost_usd ?? '0.000000',
      avgLatencyMs: parseInt(r.avg_latency_ms, 10) || 0,
    }));
  }
}
