import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageRecord } from './ai-usage.entity';
import { AiProvider, AiOperation } from '@jitre/shared';

export interface AiUsageRecordInput {
  workspaceId: string;
  userId: string;
  provider: AiProvider;
  model: string;
  operation: AiOperation;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: string;
  latencyMs: number;
  success: boolean;
  errorCode: string | null;
}

export interface UsageBucket {
  bucket: string;
  count: number;
  totalCost: string;
}

@Injectable()
export class AiUsageService {
  constructor(
    @InjectRepository(AiUsageRecord)
    private readonly repo: Repository<AiUsageRecord>,
  ) {}

  async record(input: AiUsageRecordInput): Promise<AiUsageRecord> {
    const entity = this.repo.create({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: input.provider,
      model: input.model,
      operation: input.operation,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      costUsd: input.costUsd,
      latencyMs: input.latencyMs,
      success: input.success,
      errorCode: input.errorCode,
    });
    return this.repo.save(entity);
  }

  async dailyCountForWorkspace(
    workspaceId: string,
    dateUtc: Date,
  ): Promise<number> {
    const nextDay = new Date(dateUtc);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    return this.repo
      .createQueryBuilder('r')
      .where('r.workspace_id = :workspaceId', { workspaceId })
      .andWhere('r.created_at >= :from', { from: dateUtc })
      .andWhere('r.created_at < :to', { to: nextDay })
      .andWhere('r.deleted_at IS NULL')
      .getCount();
  }

  async dailyCountForUser(
    workspaceId: string,
    userId: string,
    dateUtc: Date,
  ): Promise<number> {
    const nextDay = new Date(dateUtc);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    return this.repo
      .createQueryBuilder('r')
      .where('r.workspace_id = :workspaceId', { workspaceId })
      .andWhere('r.user_id = :userId', { userId })
      .andWhere('r.created_at >= :from', { from: dateUtc })
      .andWhere('r.created_at < :to', { to: nextDay })
      .andWhere('r.deleted_at IS NULL')
      .getCount();
  }

  async dailyCostForWorkspace(
    workspaceId: string,
    dateUtc: Date,
  ): Promise<string> {
    const nextDay = new Date(dateUtc);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const raw = await this.repo
      .createQueryBuilder('r')
      .select('SUM(r.cost_usd)', 'total')
      .where('r.workspace_id = :workspaceId', { workspaceId })
      .andWhere('r.created_at >= :from', { from: dateUtc })
      .andWhere('r.created_at < :to', { to: nextDay })
      .andWhere('r.deleted_at IS NULL')
      .getRawOne<{ total: string | null }>();

    const total = raw?.total;
    if (total === null || total === undefined) return '0.000000';
    return parseFloat(total).toFixed(6);
  }

  async usageByPeriod(
    workspaceId: string,
    from: Date,
    to: Date,
    groupBy: 'day' | 'user' | 'operation',
  ): Promise<UsageBucket[]> {
    let groupByExpr: string;
    let bucketSelect: string;

    if (groupBy === 'day') {
      groupByExpr = `DATE_TRUNC('day', r.created_at)`;
      bucketSelect = `DATE_TRUNC('day', r.created_at)::text`;
    } else if (groupBy === 'user') {
      groupByExpr = 'r.user_id';
      bucketSelect = 'r.user_id::text';
    } else {
      groupByExpr = 'r.operation';
      bucketSelect = 'r.operation::text';
    }

    const rows = await this.repo
      .createQueryBuilder('r')
      .select(bucketSelect, 'bucket')
      .addSelect('COUNT(r.id)', 'count')
      .addSelect('SUM(r.cost_usd)', 'totalCost')
      .where('r.workspace_id = :workspaceId', { workspaceId })
      .andWhere('r.created_at >= :from', { from })
      .andWhere('r.created_at < :to', { to })
      .andWhere('r.deleted_at IS NULL')
      .groupBy(groupByExpr)
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: string; count: string; totalCost: string }>();

    return rows.map((row) => ({
      bucket: row.bucket,
      count: parseInt(row.count, 10),
      totalCost: parseFloat(row.totalCost ?? '0').toFixed(6),
    }));
  }
}
