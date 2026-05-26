import { AiUsageFailureRateQuery } from './ai-usage-failure-rate.query';
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

describe('AiUsageFailureRateQuery', () => {
  it('returns failureRate = 0 when total = 0 (no division by zero)', async () => {
    const rawRows = [{ bucket: '2026-05-01', total: '0', failures: '0' }];
    const { ds } = buildMockDS(rawRows);
    const query = new AiUsageFailureRateQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'day',
      from: '2026-05-01',
      to: '2026-05-02',
    });
    expect(result[0].failureRate).toBe(0);
  });

  it('failureRate is in [0,1] range', async () => {
    const rawRows = [{ bucket: '2026-05-01', total: '10', failures: '3' }];
    const { ds } = buildMockDS(rawRows);
    const query = new AiUsageFailureRateQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'day',
      from: '2026-05-01',
      to: '2026-05-02',
    });
    const row = result.find((r) => r.total > 0);
    expect(row!.failureRate).toBeGreaterThanOrEqual(0);
    expect(row!.failureRate).toBeLessThanOrEqual(1);
    expect(row!.failureRate).toBeCloseTo(0.3);
  });

  it('returns gap-filled zeros for empty result', async () => {
    const { ds } = buildMockDS([]);
    const query = new AiUsageFailureRateQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'day',
      from: '2026-05-01',
      to: '2026-05-04',
    });
    expect(result.length).toBe(3);
    expect(result.every((r) => r.total === 0 && r.failureRate === 0)).toBe(
      true,
    );
  });

  it('uses getRawMany', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new AiUsageFailureRateQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(qb.getRawMany).toHaveBeenCalled();
  });

  it('maps raw rows to AiFailureRatePointDto shape', async () => {
    const rawRows = [{ bucket: '2026-05-01', total: '20', failures: '5' }];
    const { ds } = buildMockDS(rawRows);
    const query = new AiUsageFailureRateQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'day',
      from: '2026-05-01',
      to: '2026-05-02',
    });
    expect(result[0].total).toBe(20);
    expect(result[0].failures).toBe(5);
    expect(typeof result[0].failureRate).toBe('number');
  });
});
