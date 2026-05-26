import { WorkloadQuery } from './workload.query';
import type { DataSource } from 'typeorm';

const buildMockDS = (rawResult: unknown[] = []) => {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawResult),
  };
  const ds = { createQueryBuilder: jest.fn().mockReturnValue(qb), _qb: qb };
  return { ds: ds as unknown as DataSource, qb };
};

describe('WorkloadQuery', () => {
  describe('groupBy=assignee', () => {
    it('uses LEFT JOIN for task_assignments (unassigned bucket)', async () => {
      const { ds, qb } = buildMockDS([]);
      const query = new WorkloadQuery(ds);
      await query.execute({ workspaceId: 'ws-1', groupBy: 'assignee' });
      expect(qb.leftJoin).toHaveBeenCalled();
    });

    it('includes __unassigned__ via COALESCE', async () => {
      const { ds, qb } = buildMockDS([]);
      const query = new WorkloadQuery(ds);
      await query.execute({ workspaceId: 'ws-1', groupBy: 'assignee' });
      const selectCalls = [qb.select.mock.calls, qb.addSelect.mock.calls]
        .flat()
        .flat()
        .map(String);
      expect(selectCalls.some((s) => s.includes('__unassigned__'))).toBe(true);
    });

    it('excludes DONE-category tasks', async () => {
      const { ds, qb } = buildMockDS([]);
      const query = new WorkloadQuery(ds);
      await query.execute({ workspaceId: 'ws-1', groupBy: 'assignee' });
      const allCalls = [
        ...qb.where.mock.calls,
        ...qb.andWhere.mock.calls,
      ].flat();
      expect(allCalls.some((a: unknown) => String(a).includes('doneCategory'))).toBe(
        true,
      );
    });

    it('maps result to WorkloadBucketDto shape', async () => {
      const rawRows = [
        { key: 'user-1', count: '5' },
        { key: '__unassigned__', count: '2' },
      ];
      const { ds } = buildMockDS(rawRows);
      const query = new WorkloadQuery(ds);
      const result = await query.execute({
        workspaceId: 'ws-1',
        groupBy: 'assignee',
      });
      expect(result[0].key).toBe('user-1');
      expect(typeof result[0].count).toBe('number');
    });
  });

  describe('groupBy=status', () => {
    it('groups by status id', async () => {
      const { ds, qb } = buildMockDS([]);
      const query = new WorkloadQuery(ds);
      await query.execute({ workspaceId: 'ws-1', groupBy: 'status' });
      const groupByCalls = qb.groupBy.mock.calls.flat().map(String);
      expect(groupByCalls.some((s) => s.includes('ts.id'))).toBe(true);
    });
  });

  describe('projectId filter', () => {
    it('applies project filter when projectId provided', async () => {
      const { ds, qb } = buildMockDS([]);
      const query = new WorkloadQuery(ds);
      await query.execute({
        workspaceId: 'ws-1',
        groupBy: 'assignee',
        projectId: 'p-1',
      });
      const allCalls = [
        ...qb.where.mock.calls,
        ...qb.andWhere.mock.calls,
      ].flat();
      expect(
        allCalls.some((a: unknown) => String(a).includes('project_id')),
      ).toBe(true);
    });
  });
});
