import { StatusFlowQuery } from './status-flow.query';
import type { DataSource } from 'typeorm';

const buildMockDS = (rawResult: unknown[] = []) => {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawResult),
  };
  const ds = { createQueryBuilder: jest.fn().mockReturnValue(qb), _qb: qb };
  return { ds: ds as unknown as DataSource, qb };
};

describe('StatusFlowQuery', () => {
  it('applies LIMIT 1000', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new StatusFlowQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      projectId: 'p-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(qb.limit).toHaveBeenCalledWith(1000);
  });

  it('filters by project via subquery', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new StatusFlowQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      projectId: 'p-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    const allCalls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(
      allCalls.some((a: unknown) => String(a).includes('project_id')),
    ).toBe(true);
  });

  it('filters out rows missing previousStatusId or newStatusId', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new StatusFlowQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      projectId: 'p-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    const allCalls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls].flat();
    expect(
      allCalls.some((a: unknown) => String(a).includes('previousStatusId')),
    ).toBe(true);
  });

  it('maps raw rows to StatusFlowEdgeDto shape', async () => {
    const rawRows = [
      { from_status_id: 'status-1', to_status_id: 'status-2', count: '5' },
    ];
    const { ds } = buildMockDS(rawRows);
    const query = new StatusFlowQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      projectId: 'p-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(result[0].fromStatusId).toBe('status-1');
    expect(result[0].toStatusId).toBe('status-2');
    expect(result[0].count).toBe(5);
  });

  it('returns isLimitHit=true when rows equal 1000', async () => {
    const rawRows = Array.from({ length: 1000 }, (_, i) => ({
      from_status_id: `s-${i}`,
      to_status_id: `s-${i + 1}`,
      count: '1',
    }));
    const { ds } = buildMockDS(rawRows);
    const query = new StatusFlowQuery(ds);
    const { isLimitHit } = await query.executeWithMeta({
      workspaceId: 'ws-1',
      projectId: 'p-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(isLimitHit).toBe(true);
  });

  it('returns isLimitHit=false when rows < 1000', async () => {
    const rawRows = [
      { from_status_id: 's-1', to_status_id: 's-2', count: '3' },
    ];
    const { ds } = buildMockDS(rawRows);
    const query = new StatusFlowQuery(ds);
    const { isLimitHit } = await query.executeWithMeta({
      workspaceId: 'ws-1',
      projectId: 'p-1',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(isLimitHit).toBe(false);
  });
});
