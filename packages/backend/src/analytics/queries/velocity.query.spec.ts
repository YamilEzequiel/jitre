import { VelocityQuery } from './velocity.query';
import type { DataSource } from 'typeorm';

const buildMockQB = (rawResult: unknown[] = []) => {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawResult),
  };
  return qb;
};

const buildMockDS = (rawResult: unknown[] = []) => {
  const qb = buildMockQB(rawResult);
  const ds = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
  };
  return { ds: ds as unknown as DataSource, qb };
};

describe('VelocityQuery', () => {
  it('queries audit_logs table', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new VelocityQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    const fromArgs = qb.from.mock.calls.flat();
    expect(
      fromArgs.some((a: unknown) => String(a).includes('audit_logs')),
    ).toBe(true);
  });

  it('filters by TASK_COMPLETED action', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new VelocityQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    const allCalls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(
      allCalls.some((a: unknown) => String(a).includes('TASK_COMPLETED')),
    ).toBe(true);
  });

  it('uses getRawMany (not getMany)', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new VelocityQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(qb.getRawMany).toHaveBeenCalled();
  });

  it('returns gap-filled time series (empty raw → all zeros)', async () => {
    const { ds } = buildMockDS([]);
    const query = new VelocityQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-04',
      to: '2026-05-18',
    });
    // 2 week buckets: 2026-W19 and 2026-W20
    expect(Array.isArray(result)).toBe(true);
    expect(result.every((r) => r.value === 0)).toBe(true);
  });

  it('maps raw DB row value to number', async () => {
    // bucket label must match what to_char(date_trunc, 'IYYY-"W"IW') returns
    const rawRow = { bucket: '2026-W19', value: '3' };
    const { ds } = buildMockDS([rawRow]);
    const query = new VelocityQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-04',
      to: '2026-05-11',
    });
    const found = result.find((r) => r.value > 0);
    expect(found).toBeDefined();
    expect(typeof found!.value).toBe('number');
  });

  it('applies project scope via subquery when projectId provided', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new VelocityQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'week',
      from: '2026-05-01',
      to: '2026-05-31',
      projectId: 'proj-1',
    });
    const allCalls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(
      allCalls.some((a: unknown) => String(a).includes('project_id')),
    ).toBe(true);
  });

  it('filters by workspaceId', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new VelocityQuery(ds);
    await query.execute({
      workspaceId: 'ws-test-123',
      period: 'day',
      from: '2026-05-01',
      to: '2026-05-02',
    });
    const allCalls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(
      allCalls.some((a: unknown) => String(a).includes('workspace_id')),
    ).toBe(true);
  });
});
