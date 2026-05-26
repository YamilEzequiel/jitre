import { LeadTimeQuery } from './lead-time.query';
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

describe('LeadTimeQuery', () => {
  it('queries tasks table', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new LeadTimeQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'month',
      from: '2026-01-01',
      to: '2026-06-01',
    });
    expect(
      qb.from.mock.calls
        .flat()
        .some((a: unknown) => String(a).includes('tasks')),
    ).toBe(true);
  });

  it('uses percentile_cont for p50, p75, p95', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new LeadTimeQuery(ds);
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
    expect(selectCalls.some((s) => s.includes('percentile_cont(0.75)'))).toBe(
      true,
    );
    expect(selectCalls.some((s) => s.includes('percentile_cont(0.95)'))).toBe(
      true,
    );
  });

  it('filters completed tasks (completed_at IS NOT NULL)', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new LeadTimeQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'month',
      from: '2026-01-01',
      to: '2026-06-01',
    });
    const allCalls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(
      allCalls.some((a: unknown) => String(a).includes('completed_at')),
    ).toBe(true);
  });

  it('returns empty array for empty result', async () => {
    const { ds } = buildMockDS([]);
    const query = new LeadTimeQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'month',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it('maps raw row to DurationStatsDto shape', async () => {
    const rawRow = {
      period: '2026-05',
      p50: '86400',
      p75: '172800',
      p95: '259200',
      mean: '100000',
      count: '5',
    };
    const { ds } = buildMockDS([rawRow]);
    const query = new LeadTimeQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      period: 'month',
      from: '2026-05-01',
      to: '2026-06-01',
    });
    const found = result.find((r) => r.count > 0);
    expect(found).toBeDefined();
    expect(typeof found!.p50).toBe('number');
    expect(typeof found!.count).toBe('number');
  });

  it('applies project filter when projectId provided', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new LeadTimeQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      period: 'month',
      from: '2026-01-01',
      to: '2026-06-01',
      projectId: 'p-1',
    });
    const allCalls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(
      allCalls.some((a: unknown) => String(a).includes('project_id')),
    ).toBe(true);
  });
});
