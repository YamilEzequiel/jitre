import { AiUsageByUserQuery } from './ai-usage-by-user.query';
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
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawResult),
  };
  const ds = { createQueryBuilder: jest.fn().mockReturnValue(qb), _qb: qb };
  return { ds: ds as unknown as DataSource, qb };
};

describe('AiUsageByUserQuery', () => {
  it('applies LIMIT 20', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new AiUsageByUserQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(qb.limit).toHaveBeenCalledWith(20);
  });

  it('orders by SUM(cost_usd) DESC', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new AiUsageByUserQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    const orderCalls = qb.orderBy.mock.calls;
    expect(
      orderCalls.some((c: unknown[]) => String(c[1]).includes('DESC')),
    ).toBe(true);
  });

  it('groups by user_id', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new AiUsageByUserQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    const groupByCalls = qb.groupBy.mock.calls.flat().map(String);
    expect(groupByCalls.some((s) => s.includes('user_id'))).toBe(true);
  });

  it('returns costUsd as string', async () => {
    const rawRows = [{ user_id: 'u-1', requests: '10', cost_usd: '1.500000' }];
    const { ds } = buildMockDS(rawRows);
    const query = new AiUsageByUserQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(typeof result[0].costUsd).toBe('string');
    expect(result[0].userId).toBe('u-1');
  });

  it('uses getRawMany', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new AiUsageByUserQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(qb.getRawMany).toHaveBeenCalled();
  });
});
