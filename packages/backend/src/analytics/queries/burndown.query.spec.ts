import { BurndownQuery } from './burndown.query';
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

describe('BurndownQuery', () => {
  it('returns exactly 1 row for single-day range', async () => {
    const rawRows = [{ date: '2026-05-01', remaining: '3' }];
    const { ds } = buildMockDS(rawRows);
    const query = new BurndownQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      projectId: 'p-1',
      from: '2026-05-01',
      to: '2026-05-02',
    });
    expect(result.length).toBe(1);
    expect(result[0].date).toBe('2026-05-01');
  });

  it('uses getRawMany', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new BurndownQuery(ds);
    await query.execute({
      workspaceId: 'ws-1',
      projectId: 'p-1',
      from: '2026-05-01',
      to: '2026-05-08',
    });
    expect(qb.getRawMany).toHaveBeenCalled();
  });

  it('passes workspace and project parameters used by the remaining-tasks subquery', async () => {
    const { ds, qb } = buildMockDS([]);
    const query = new BurndownQuery(ds);
    await query.execute({
      workspaceId: 'ws-test',
      projectId: 'p-1',
      from: '2026-05-01',
      to: '2026-05-08',
    });
    expect(qb.where).toHaveBeenCalledWith(
      '1=1',
      expect.objectContaining({ workspaceId: 'ws-test', projectId: 'p-1' }),
    );
  });

  it('maps raw rows to BurndownPointDto shape', async () => {
    const rawRows = [
      { date: '2026-05-01', remaining: '10' },
      { date: '2026-05-02', remaining: '8' },
    ];
    const { ds } = buildMockDS(rawRows);
    const query = new BurndownQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      projectId: 'p-1',
      from: '2026-05-01',
      to: '2026-05-03',
    });
    expect(result[0].remaining).toBe(10);
    expect(typeof result[0].date).toBe('string');
  });

  it('returns zero remaining for empty project', async () => {
    const rawRows = [{ date: '2026-05-01', remaining: '0' }];
    const { ds } = buildMockDS(rawRows);
    const query = new BurndownQuery(ds);
    const result = await query.execute({
      workspaceId: 'ws-1',
      projectId: 'p-empty',
      from: '2026-05-01',
      to: '2026-05-02',
    });
    expect(result[0].remaining).toBe(0);
  });
});
