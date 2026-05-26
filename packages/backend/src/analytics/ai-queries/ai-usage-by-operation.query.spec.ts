import { AiUsageByOperationQuery } from './ai-usage-by-operation.query';
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

describe('AiUsageByOperationQuery', () => {
  it('does NOT apply a row LIMIT (max 5 operations)', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new AiUsageByOperationQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    // Should NOT call .limit()
    expect(qb.getRawMany).toHaveBeenCalled();
  });

  it('groups by operation', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new AiUsageByOperationQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    const groupByCalls = qb.groupBy.mock.calls.flat().map(String);
    expect(groupByCalls.some((s) => s.includes('operation'))).toBe(true);
  });

  it('maps raw rows to AiUsageByOperationDto shape', async () => {
    const rawRows = [
      {
        operation: 'DESCRIBE',
        requests: '20',
        cost_usd: '2.000000',
        avg_latency_ms: '350',
      },
    ];
    const { ds } = buildMockDS(rawRows);
    const query = new AiUsageByOperationQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(result[0].operation).toBe('DESCRIBE');
    expect(typeof result[0].costUsd).toBe('string');
    expect(typeof result[0].avgLatencyMs).toBe('number');
  });

  it('uses getRawMany', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new AiUsageByOperationQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(qb.getRawMany).toHaveBeenCalled();
  });
});
