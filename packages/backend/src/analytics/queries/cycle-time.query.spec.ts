import { CycleTimeQuery } from './cycle-time.query';
import type { DataSource } from 'typeorm';

const buildMockDS = (rawResult: unknown[] = []) => {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawResult),
  };
  const ds = { createQueryBuilder: jest.fn().mockReturnValue(qb), _qb: qb };
  return { ds: ds as unknown as DataSource, qb };
};

describe('CycleTimeQuery', () => {
  it('returns empty array for empty raw result', async () => {
    const { ds } = buildMockDS([]);
    const query = new CycleTimeQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'month',
      from: '2026-01-01',
      to: '2026-06-01',
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it('uses percentile_cont for p50, p75, p95', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new CycleTimeQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'month',
      from: '2026-01-01',
      to: '2026-06-01',
    });
    const selectCalls = qb.addSelect.mock.calls.flat().map(String);
    expect(selectCalls.some((s) => s.includes('percentile_cont(0.5)'))).toBe(
      true,
    );
  });

  it('uses getRawMany', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new CycleTimeQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'month',
      from: '2026-01-01',
      to: '2026-06-01',
    });
    expect(qb.getRawMany).toHaveBeenCalled();
  });

  it('maps raw row to DurationStatsDto shape', async () => {
    const rawRow = {
      period: '2026-05',
      p50: '3600',
      p75: '7200',
      p95: '14400',
      mean: '5000',
      count: '3',
    };
    const { ds } = buildMockDS([rawRow]);
    const query = new CycleTimeQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'month',
      from: '2026-05-01',
      to: '2026-06-01',
    });
    expect(result[0].p50).toBe(3600);
    expect(result[0].count).toBe(3);
  });
});
