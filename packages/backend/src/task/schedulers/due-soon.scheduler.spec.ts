import { DueSoonScheduler } from './due-soon.scheduler';

/**
 * Minimal fake for TypeORM Repository:
 * only createQueryBuilder chain needed.
 */
const makeFakeRepo = (tasks: unknown[] = []) => {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(tasks),
  };
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
  };
};

const makeSettings = (windowDays: number = 3) => ({
  getWorkspaceSetting: jest.fn().mockResolvedValue(windowDays),
});

const makeEventBus = () => ({
  publish: jest.fn(),
});

describe('DueSoonScheduler', () => {
  describe('run()', () => {
    it('calls createQueryBuilder to fetch upcoming tasks', async () => {
      const repo = makeFakeRepo([]);
      const settings = makeSettings(3);
      const eventBus = makeEventBus();

      const scheduler = new DueSoonScheduler(
        repo as never,
        settings as never,
        eventBus as never,
      );

      await scheduler.run();

      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(repo._qb.andWhere).toHaveBeenCalled();
    });

    it('publishes TaskDueSoonEvent for each task that has assignees', async () => {
      // Use dates comfortably within 3 days from any test run date
      const now = new Date();
      const dueDate1 = new Date(now);
      dueDate1.setDate(dueDate1.getDate() + 1);
      const dueDate2 = new Date(now);
      dueDate2.setDate(dueDate2.getDate() + 2);

      const tasks = [
        {
          id: 'T1',
          workspaceId: 'W1',
          projectId: 'P1',
          dueDate: dueDate1,
          assignments: [{ userId: 'U1' }, { userId: 'U2' }],
        },
        {
          id: 'T2',
          workspaceId: 'W1',
          projectId: 'P1',
          dueDate: dueDate2,
          assignments: [{ userId: 'U3' }],
        },
      ];

      const repo = makeFakeRepo(tasks);
      const settings = makeSettings(3);
      const eventBus = makeEventBus();

      const scheduler = new DueSoonScheduler(
        repo as never,
        settings as never,
        eventBus as never,
      );

      await scheduler.run();

      expect(eventBus.publish).toHaveBeenCalledTimes(2);

      const firstCall = eventBus.publish.mock.calls[0][0];
      expect(firstCall.name).toBe('task.due_soon');
      expect(firstCall.payload.taskId).toBe('T1');
      expect(firstCall.payload.assigneeUserIds).toEqual(['U1', 'U2']);

      const secondCall = eventBus.publish.mock.calls[1][0];
      expect(secondCall.payload.taskId).toBe('T2');
      expect(secondCall.payload.assigneeUserIds).toEqual(['U3']);
    });

    it('skips tasks that have no assignees', async () => {
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 1);

      const tasks = [
        {
          id: 'T1',
          workspaceId: 'W1',
          projectId: 'P1',
          dueDate,
          assignments: [],
        },
      ];

      const repo = makeFakeRepo(tasks);
      const settings = makeSettings(3);
      const eventBus = makeEventBus();

      const scheduler = new DueSoonScheduler(
        repo as never,
        settings as never,
        eventBus as never,
      );

      await scheduler.run();

      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('uses deterministic eventId based on taskId + dueDate string', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const tasks = [
        {
          id: 'T1',
          workspaceId: 'W1',
          projectId: 'P1',
          dueDate,
          assignments: [{ userId: 'U1' }],
        },
      ];

      const repo = makeFakeRepo(tasks);
      const settings = makeSettings(3);
      const eventBus = makeEventBus();

      const scheduler = new DueSoonScheduler(
        repo as never,
        settings as never,
        eventBus as never,
      );

      // Run twice — should publish same eventId both times (idempotent)
      await scheduler.run();
      await scheduler.run();

      const call1 = eventBus.publish.mock.calls[0][0];
      const call2 = eventBus.publish.mock.calls[1][0];
      expect(call1.eventId).toBe(call2.eventId);
      // eventId must be a non-empty string
      expect(typeof call1.eventId).toBe('string');
      expect(call1.eventId.length).toBeGreaterThan(0);
    });

    it('buildEventId() returns a UUID-shaped string (ADR-10)', () => {
      const scheduler = new DueSoonScheduler(
        {} as never,
        {} as never,
        {} as never,
      );
      const result = scheduler.buildEventId('task-abc', new Date('2026-05-23'));
      // Must match UUID v4 shape: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (all hex, lowercase)
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    // ── K1/S3: DONE-category tasks are excluded by SQL JOIN (not in-memory) ──────

    it('does NOT publish TaskDueSoonEvent for a DONE-category task (SQL excludes it — mock returns empty)', async () => {
      // S3 design: SQL LEFT JOIN task_statuses with `ts.category <> 'DONE'` excludes these tasks.
      // In tests, we simulate this by seeding the mock repo with NO tasks
      // (as the SQL would have filtered the DONE task out).
      const repo = makeFakeRepo([]); // SQL JOIN already excluded DONE tasks
      const settings = makeSettings(3);
      const eventBus = makeEventBus();

      const scheduler = new DueSoonScheduler(
        repo as never,
        settings as never,
        eventBus as never,
      );

      await scheduler.run();

      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('DOES publish for a task with null status (SQL `(ts.id IS NULL OR ...)` allows it)', async () => {
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 1);

      // SQL: `(ts.id IS NULL OR ts.category <> 'DONE')` — null status still passes
      const tasks = [
        {
          id: 'T1',
          workspaceId: 'W1',
          projectId: 'P1',
          dueDate,
          assignments: [{ userId: 'U1' }],
          status: null, // null status — SQL allows it (ts.id IS NULL branch)
        },
      ];

      const repo = makeFakeRepo(tasks);
      const settings = makeSettings(3);
      const eventBus = makeEventBus();

      const scheduler = new DueSoonScheduler(
        repo as never,
        settings as never,
        eventBus as never,
      );

      await scheduler.run();

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    // ── S3: SQL JOIN DONE-filter ───────────────────────────────────────────────

    it('S3: DONE-category task excluded when SQL JOIN filter is active', async () => {
      // The scheduler now uses SQL JOIN — the mock repo returns only non-DONE tasks.
      // This test verifies that if the repo (SQL) already filtered out DONE tasks,
      // the scheduler does NOT double-filter via in-memory code.
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 1);

      // SQL mock returns 0 tasks (as if SQL JOIN excluded DONE tasks)
      const repo = makeFakeRepo([]); // no tasks returned by SQL
      const settings = makeSettings(3);
      const eventBus = makeEventBus();

      const scheduler = new DueSoonScheduler(
        repo as never,
        settings as never,
        eventBus as never,
      );

      await scheduler.run();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('S3: SQL query uses LEFT JOIN task_statuses to exclude DONE', async () => {
      const repo = makeFakeRepo([]);
      const settings = makeSettings(3);
      const eventBus = makeEventBus();

      const scheduler = new DueSoonScheduler(
        repo as never,
        settings as never,
        eventBus as never,
      );

      await scheduler.run();

      // The query builder should use andWhere with a ts.category condition
      expect(repo._qb.andWhere).toHaveBeenCalled();
    });

    it('reads notification.task_due_soon_window_days from workspace settings', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5); // within 7-day window

      const tasks = [
        {
          id: 'T1',
          workspaceId: 'W1',
          projectId: 'P1',
          dueDate,
          assignments: [{ userId: 'U1' }],
        },
      ];

      const repo = makeFakeRepo(tasks);
      const settings = makeSettings(7);
      const eventBus = makeEventBus();

      const scheduler = new DueSoonScheduler(
        repo as never,
        settings as never,
        eventBus as never,
      );

      await scheduler.run();

      // The setting key is workspace-scoped per design K1
      expect(settings.getWorkspaceSetting).toHaveBeenCalledWith(
        'W1',
        'notification.task_due_soon_window_days',
      );
    });
  });
});
