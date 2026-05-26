import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '@jitre/shared';
import {
  TimeEntryService,
  computeDurationMinutes,
} from './time-entry.service';
import { TimeEntryEntity } from './time-entry.entity';
import { TaskEntity } from '../task/task.entity';
import { EventBusService } from '../events/event-bus.service';
import { TimeReportGroupBy } from './dto/time-report.query.dto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<TimeEntryEntity> = {}): TimeEntryEntity {
  return {
    id: 'TE1',
    workspaceId: 'W1',
    taskId: 'T1',
    userId: 'U1',
    durationMinutes: 60,
    date: new Date('2026-05-20'),
    description: null,
    billable: true,
    startedAt: null,
    stoppedAt: null,
    createdAt: new Date('2026-05-20T10:00:00Z'),
    updatedAt: new Date('2026-05-20T10:00:00Z'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  } as TimeEntryEntity;
}

function makeQueryBuilder(returnValue: unknown): Record<string, jest.Mock> {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(returnValue),
    getRawMany: jest.fn().mockResolvedValue(returnValue),
    getRawOne: jest.fn().mockResolvedValue(returnValue),
  };
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

let timeEntryRepo: {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  softDelete: jest.Mock;
  createQueryBuilder: jest.Mock;
};
let taskRepo: { findOne: jest.Mock };
let eventBus: { publish: jest.Mock };

describe('computeDurationMinutes()', () => {
  it('rounds positive intervals to nearest minute', () => {
    expect(
      computeDurationMinutes(
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-01-01T00:30:00Z'),
      ),
    ).toBe(30);
  });

  it('returns 0 when stoppedAt <= startedAt', () => {
    expect(
      computeDurationMinutes(
        new Date('2026-01-01T00:30:00Z'),
        new Date('2026-01-01T00:30:00Z'),
      ),
    ).toBe(0);
    expect(
      computeDurationMinutes(
        new Date('2026-01-01T01:00:00Z'),
        new Date('2026-01-01T00:00:00Z'),
      ),
    ).toBe(0);
  });

  it('rounds half-minutes up', () => {
    expect(
      computeDurationMinutes(
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-01-01T00:00:30Z'),
      ),
    ).toBe(1);
  });
});

describe('TimeEntryService', () => {
  let service: TimeEntryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    timeEntryRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    taskRepo = { findOne: jest.fn() };
    eventBus = { publish: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TimeEntryService,
        {
          provide: getRepositoryToken(TimeEntryEntity),
          useValue: timeEntryRepo,
        },
        { provide: getRepositoryToken(TaskEntity), useValue: taskRepo },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get(TimeEntryService);
  });

  // ── create ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('rejects when the task does not belong to the workspace', async () => {
      taskRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.create({
          workspaceId: 'W1',
          actorUserId: 'U1',
          taskId: 'T-bad',
          durationMinutes: 30,
          date: '2026-05-20',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(timeEntryRepo.save).not.toHaveBeenCalled();
    });

    it('saves an entry stamped with the current user and publishes a created event', async () => {
      taskRepo.findOne.mockResolvedValueOnce({ id: 'T1' });
      timeEntryRepo.create.mockImplementation(
        (data: Partial<TimeEntryEntity>) => makeEntry(data),
      );
      timeEntryRepo.save.mockImplementation(
        async (e: TimeEntryEntity) => ({ ...e, id: 'TE-new' }) as TimeEntryEntity,
      );

      const saved = await service.create({
        workspaceId: 'W1',
        actorUserId: 'U-actor',
        taskId: 'T1',
        durationMinutes: 45,
        date: '2026-05-20',
        description: 'fix bug',
        billable: false,
      });

      expect(saved.id).toBe('TE-new');
      expect(saved.userId).toBe('U-actor');
      expect(saved.billable).toBe(false);
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const evt = eventBus.publish.mock.calls[0]![0] as {
        name: string;
        payload: { timerStarted: boolean; durationMinutes: number };
      };
      expect(evt.name).toBe('timeEntry.created');
      expect(evt.payload.timerStarted).toBe(false);
      expect(evt.payload.durationMinutes).toBe(45);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('lets the owner update their own entry', async () => {
      const entry = makeEntry({ id: 'TE1', userId: 'U-owner' });
      timeEntryRepo.findOne.mockResolvedValueOnce(entry);
      timeEntryRepo.save.mockImplementation(async (e: TimeEntryEntity) => e);

      const result = await service.update({
        id: 'TE1',
        workspaceId: 'W1',
        actorUserId: 'U-owner',
        actorRole: WorkspaceRole.MEMBER,
        durationMinutes: 90,
      });

      expect(result.durationMinutes).toBe(90);
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const evt = eventBus.publish.mock.calls[0]![0] as { name: string };
      expect(evt.name).toBe('timeEntry.updated');
    });

    it('forbids a non-owner non-admin from updating', async () => {
      timeEntryRepo.findOne.mockResolvedValueOnce(
        makeEntry({ userId: 'U-other' }),
      );

      await expect(
        service.update({
          id: 'TE1',
          workspaceId: 'W1',
          actorUserId: 'U-actor',
          actorRole: WorkspaceRole.MEMBER,
          durationMinutes: 30,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(timeEntryRepo.save).not.toHaveBeenCalled();
    });

    it('lets a workspace ADMIN edit anyone’s entry', async () => {
      timeEntryRepo.findOne.mockResolvedValueOnce(
        makeEntry({ userId: 'U-other' }),
      );
      timeEntryRepo.save.mockImplementation(async (e: TimeEntryEntity) => e);

      const result = await service.update({
        id: 'TE1',
        workspaceId: 'W1',
        actorUserId: 'U-admin',
        actorRole: WorkspaceRole.ADMIN,
        billable: false,
      });

      expect(result.billable).toBe(false);
    });

    it('does NOT publish an event when nothing actually changed', async () => {
      const entry = makeEntry({
        userId: 'U-owner',
        durationMinutes: 60,
        billable: true,
      });
      timeEntryRepo.findOne.mockResolvedValueOnce(entry);
      timeEntryRepo.save.mockImplementation(async (e: TimeEntryEntity) => e);

      await service.update({
        id: 'TE1',
        workspaceId: 'W1',
        actorUserId: 'U-owner',
        actorRole: WorkspaceRole.MEMBER,
        durationMinutes: 60,
        billable: true,
      });

      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  // ── delete ──────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('soft-deletes and emits the deleted event for the owner', async () => {
      timeEntryRepo.findOne.mockResolvedValueOnce(
        makeEntry({ userId: 'U-owner' }),
      );
      timeEntryRepo.softDelete.mockResolvedValueOnce(undefined);

      await service.delete({
        id: 'TE1',
        workspaceId: 'W1',
        actorUserId: 'U-owner',
        actorRole: WorkspaceRole.MEMBER,
      });

      expect(timeEntryRepo.softDelete).toHaveBeenCalledWith('TE1');
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const evt = eventBus.publish.mock.calls[0]![0] as { name: string };
      expect(evt.name).toBe('timeEntry.deleted');
    });

    it('refuses delete for a non-owner non-admin', async () => {
      timeEntryRepo.findOne.mockResolvedValueOnce(
        makeEntry({ userId: 'U-other' }),
      );
      await expect(
        service.delete({
          id: 'TE1',
          workspaceId: 'W1',
          actorUserId: 'U-actor',
          actorRole: WorkspaceRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(timeEntryRepo.softDelete).not.toHaveBeenCalled();
    });
  });

  // ── list ────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('forces userId = actor for non-admin callers', async () => {
      const qb = makeQueryBuilder([]);
      timeEntryRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.list({
        workspaceId: 'W1',
        actorUserId: 'U-actor',
        actorRole: WorkspaceRole.MEMBER,
        userId: 'U-someoneElse', // <- should be ignored
      });

      // The userId filter must be `:actorUserId`, not the requested one.
      const calls = (qb.andWhere as jest.Mock).mock.calls.map(
        (c: unknown[]) => c as [string, Record<string, unknown> | undefined],
      );
      const userScopeCall = calls.find((c) =>
        c[0].includes('te.userId = :actorUserId'),
      );
      expect(userScopeCall).toBeDefined();
      expect(userScopeCall![1]).toEqual({ actorUserId: 'U-actor' });
      const overrideCall = calls.find((c) =>
        c[0].includes('te.userId = :userId'),
      );
      expect(overrideCall).toBeUndefined();
    });

    it('lets ADMIN scope to any user', async () => {
      const qb = makeQueryBuilder([]);
      timeEntryRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.list({
        workspaceId: 'W1',
        actorUserId: 'U-admin',
        actorRole: WorkspaceRole.ADMIN,
        userId: 'U-target',
      });

      const calls = (qb.andWhere as jest.Mock).mock.calls.map(
        (c: unknown[]) => c as [string, Record<string, unknown> | undefined],
      );
      const overrideCall = calls.find((c) =>
        c[0].includes('te.userId = :userId'),
      );
      expect(overrideCall).toBeDefined();
      expect(overrideCall![1]).toEqual({ userId: 'U-target' });
    });
  });

  // ── timer flow ──────────────────────────────────────────────────────────

  describe('startTimer() / stopActiveTimer()', () => {
    it('starts a new timer when no active one exists', async () => {
      taskRepo.findOne.mockResolvedValueOnce({ id: 'T1' });
      timeEntryRepo.findOne.mockResolvedValueOnce(null); // no active timer
      timeEntryRepo.create.mockImplementation(
        (data: Partial<TimeEntryEntity>) => makeEntry(data),
      );
      timeEntryRepo.save.mockImplementation(
        async (e: TimeEntryEntity) => ({ ...e, id: 'TE-timer' }) as TimeEntryEntity,
      );

      const result = await service.startTimer({
        workspaceId: 'W1',
        actorUserId: 'U1',
        taskId: 'T1',
      });

      expect(result.id).toBe('TE-timer');
      expect(result.durationMinutes).toBe(0);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.stoppedAt).toBeNull();
      const evt = eventBus.publish.mock.calls[0]![0] as {
        name: string;
        payload: { timerStarted: boolean };
      };
      expect(evt.payload.timerStarted).toBe(true);
    });

    it('auto-stops a previously active timer before starting a new one', async () => {
      taskRepo.findOne.mockResolvedValueOnce({ id: 'T2' });
      const active = makeEntry({
        id: 'TE-active',
        userId: 'U1',
        taskId: 'T1',
        startedAt: new Date('2026-05-20T09:00:00Z'),
        stoppedAt: null,
      });
      timeEntryRepo.findOne.mockResolvedValueOnce(active); // first call: getActiveTimer
      timeEntryRepo.save.mockImplementation(async (e: TimeEntryEntity) => e);
      timeEntryRepo.create.mockImplementation(
        (data: Partial<TimeEntryEntity>) => makeEntry({ ...data, id: 'TE-new' }),
      );

      const result = await service.startTimer({
        workspaceId: 'W1',
        actorUserId: 'U1',
        taskId: 'T2',
      });

      // Two saves: one for the auto-stop, one for the new entry.
      expect(timeEntryRepo.save).toHaveBeenCalledTimes(2);
      const stoppedSave = timeEntryRepo.save.mock.calls[0]![0] as TimeEntryEntity;
      expect(stoppedSave.id).toBe('TE-active');
      expect(stoppedSave.stoppedAt).toBeInstanceOf(Date);
      expect(result.id).toBe('TE-new');
      // Two events: timer stopped + timer started.
      const names = eventBus.publish.mock.calls.map(
        (c) => (c[0] as { name: string }).name,
      );
      expect(names).toEqual(['timeEntry.updated', 'timeEntry.created']);
    });

    it('stopActiveTimer throws NotFound when there is no active timer', async () => {
      timeEntryRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.stopActiveTimer('W1', 'U1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('stopActiveTimer computes durationMinutes from startedAt → now', async () => {
      const startedAt = new Date(Date.now() - 90 * 60 * 1000); // 90 min ago
      const active = makeEntry({
        id: 'TE-active',
        userId: 'U1',
        workspaceId: 'W1',
        startedAt,
        stoppedAt: null,
      });
      timeEntryRepo.findOne.mockResolvedValueOnce(active);
      timeEntryRepo.save.mockImplementation(async (e: TimeEntryEntity) => e);

      const result = await service.stopActiveTimer('W1', 'U1');
      expect(result.stoppedAt).toBeInstanceOf(Date);
      expect(result.durationMinutes).toBeGreaterThanOrEqual(89);
      expect(result.durationMinutes).toBeLessThanOrEqual(91);
      const evt = eventBus.publish.mock.calls[0]![0] as {
        payload: { timerStopped: boolean };
      };
      expect(evt.payload.timerStopped).toBe(true);
    });

    it('stopActiveTimer refuses to close a timer that belongs to another workspace', async () => {
      const active = makeEntry({
        userId: 'U1',
        workspaceId: 'W-OTHER',
        startedAt: new Date(),
      });
      timeEntryRepo.findOne.mockResolvedValueOnce(active);
      await expect(service.stopActiveTimer('W1', 'U1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('getActiveTimer returns null when no active timer exists', async () => {
      timeEntryRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.getActiveTimer('U1');
      expect(result).toBeNull();
    });
  });

  // ── reports / aggregates ───────────────────────────────────────────────

  describe('report()', () => {
    it('groups by user with SQL GROUP BY (admin scope)', async () => {
      const qb = makeQueryBuilder([
        { groupKey: 'U1', totalMinutes: 120, entryCount: 3 },
        { groupKey: 'U2', totalMinutes: 60, entryCount: 1 },
      ]);
      timeEntryRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const rows = await service.report({
        workspaceId: 'W1',
        actorUserId: 'U-admin',
        actorRole: WorkspaceRole.ADMIN,
        groupBy: TimeReportGroupBy.USER,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
      });

      expect(rows).toEqual([
        { groupKey: 'U1', totalMinutes: 120, entryCount: 3 },
        { groupKey: 'U2', totalMinutes: 60, entryCount: 1 },
      ]);
      expect(qb.groupBy).toHaveBeenCalled();
    });

    it('forces actorUserId scope for non-admin callers', async () => {
      const qb = makeQueryBuilder([]);
      timeEntryRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.report({
        workspaceId: 'W1',
        actorUserId: 'U-actor',
        actorRole: WorkspaceRole.MEMBER,
        groupBy: TimeReportGroupBy.DATE,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
        userId: 'U-target', // ignored
      });

      const calls = (qb.andWhere as jest.Mock).mock.calls.map(
        (c: unknown[]) => c as [string, Record<string, unknown> | undefined],
      );
      const scope = calls.find((c) =>
        c[0].includes('te.user_id = :actorUserId'),
      );
      expect(scope).toBeDefined();
      expect(scope![1]).toEqual({ actorUserId: 'U-actor' });
      const cross = calls.find((c) => c[0].includes('te.user_id = :userId'));
      expect(cross).toBeUndefined();
    });

    it('coerces SQL numeric strings into numbers', async () => {
      const qb = makeQueryBuilder([
        { groupKey: '2026-05-20', totalMinutes: '180', entryCount: '4' },
      ]);
      timeEntryRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const rows = await service.report({
        workspaceId: 'W1',
        actorUserId: 'U-admin',
        actorRole: WorkspaceRole.ADMIN,
        groupBy: TimeReportGroupBy.DATE,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
      });

      expect(rows[0]!.totalMinutes).toBe(180);
      expect(rows[0]!.entryCount).toBe(4);
      expect(typeof rows[0]!.totalMinutes).toBe('number');
    });
  });

  describe('totalForTask()', () => {
    it('sums duration_minutes via SQL', async () => {
      const qb = makeQueryBuilder({ total: '240' });
      timeEntryRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const total = await service.totalForTask('T1', 'W1');
      expect(total).toBe(240);
    });

    it('returns 0 when SQL returns null', async () => {
      const qb = makeQueryBuilder({ total: null });
      timeEntryRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const total = await service.totalForTask('T1', 'W1');
      expect(total).toBe(0);
    });
  });

  describe('summaryForTask()', () => {
    it('returns total + entries scoped to caller for non-admin', async () => {
      taskRepo.findOne.mockResolvedValueOnce({ id: 'T1' });
      const totalQb = makeQueryBuilder({ total: '90' });
      const entriesQb = makeQueryBuilder([makeEntry({ id: 'E1' })]);
      timeEntryRepo.createQueryBuilder
        .mockReturnValueOnce(totalQb)
        .mockReturnValueOnce(entriesQb);

      const result = await service.summaryForTask(
        'T1',
        'W1',
        'U-actor',
        WorkspaceRole.MEMBER,
      );

      expect(result.totalMinutes).toBe(90);
      expect(result.entries).toHaveLength(1);
      const calls = (entriesQb.andWhere as jest.Mock).mock.calls.map(
        (c: unknown[]) => c as [string, Record<string, unknown> | undefined],
      );
      const scope = calls.find((c) =>
        c[0].includes('te.userId = :actorUserId'),
      );
      expect(scope).toBeDefined();
    });

    it('throws NotFound when task does not belong to workspace', async () => {
      taskRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.summaryForTask('T-bad', 'W1', 'U1', WorkspaceRole.MEMBER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('totalForUserPerDay()', () => {
    it('returns per-day aggregates', async () => {
      const qb = makeQueryBuilder([
        { date: '2026-05-20', totalMinutes: '120' },
        { date: '2026-05-21', totalMinutes: '60' },
      ]);
      timeEntryRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const result = await service.totalForUserPerDay(
        'U1',
        'W1',
        '2026-05-01',
        '2026-05-31',
      );

      expect(result).toEqual([
        { date: '2026-05-20', totalMinutes: 120 },
        { date: '2026-05-21', totalMinutes: 60 },
      ]);
    });
  });
});
