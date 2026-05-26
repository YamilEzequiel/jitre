import { ThroughputQuery } from './throughput.query';
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

describe('ThroughputQuery', () => {
  it('queries audit_logs table', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new ThroughputQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(
      qb.from.mock.calls
        .flat()
        .some((a: unknown) => String(a).includes('audit_logs')),
    ).toBe(true);
  });

  it('filters by TASK_STATUS_CHANGED action', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new ThroughputQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    const allCalls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(
      allCalls.some((a: unknown) => String(a).includes('TASK_STATUS_CHANGED')),
    ).toBe(true);
  });

  it('uses jsonb containment filter for done category', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new ThroughputQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    const allCalls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(
      allCalls.some((a: unknown) => String(a).includes('newCategory')),
    ).toBe(true);
  });

  it('returns gap-filled zeros for empty result', async () => {
    const { ds } = buildMockDS([]);
    const query = new ThroughputQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'day',
      from: '2026-05-01',
      to: '2026-05-04',
    });
    expect(result.every((r) => r.value === 0)).toBe(true);
    expect(result.length).toBe(3);
  });

  it('uses getRawMany', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new ThroughputQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(qb.getRawMany).toHaveBeenCalled();
  });
});
