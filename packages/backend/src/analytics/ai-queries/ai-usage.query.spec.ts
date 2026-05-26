import { AiUsageQuery } from './ai-usage.query';
import type { DataSource } from 'typeorm';

const buildMockDS = (rawResult: unknown[] = []) => {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawResult),
  };
  const ds = { createQueryBuilder: jest.fn().mockReturnValue(qb), _qb: qb };
  return { ds: ds as unknown as DataSource, qb };
};

describe('AiUsageQuery', () => {
  it('queries ai_usage_records table', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new AiUsageQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'day',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(
      qb.from.mock.calls
        .flat()
        .some((a: unknown) => String(a).includes('ai_usage_records')),
    ).toBe(true);
  });

  it('returns gap-filled zeros for empty result', async () => {
    const { ds } = buildMockDS([]);
    const query = new AiUsageQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'day',
      from: '2026-05-01',
      to: '2026-05-04',
    });
    expect(result.every((r) => r.requests === 0)).toBe(true);
    expect(result.length).toBe(3);
  });

  it('returns costUsd as string', async () => {
    const rawRow = {
      bucket: '2026-05-01',
      requests: '5',
      cost_usd: '0.125000',
      total_tokens: '1000',
    };
    const { ds } = buildMockDS([rawRow]);
    const query = new AiUsageQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'day',
      from: '2026-05-01',
      to: '2026-05-02',
    });
    const row = result.find((r) => r.requests > 0);
    expect(row).toBeDefined();
    expect(typeof row!.costUsd).toBe('string');
  });

  it('uses getRawMany', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new AiUsageQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(qb.getRawMany).toHaveBeenCalled();
  });

  it('maps requests and totalTokens as numbers', async () => {
    const rawRow = {
      bucket: '2026-05-01',
      requests: '3',
      cost_usd: '0.100000',
      total_tokens: '500',
    };
    const { ds } = buildMockDS([rawRow]);
    const query = new AiUsageQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'day',
      from: '2026-05-01',
      to: '2026-05-02',
    });
    const row = result.find((r) => r.requests > 0);
    expect(typeof row!.requests).toBe('number');
    expect(typeof row!.totalTokens).toBe('number');
  });
});
