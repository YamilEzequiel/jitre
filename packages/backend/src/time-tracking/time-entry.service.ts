import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Not, Repository } from 'typeorm';
import { WorkspaceRole, hasAtLeastRole } from '@jitre/shared';
import { TimeEntryEntity } from './time-entry.entity';
import { TaskEntity } from '../task/task.entity';
import { EventBusService } from '../events/event-bus.service';
import {
  TimeEntryCreatedEvent,
  TimeEntryUpdatedEvent,
  TimeEntryDeletedEvent,
} from './events';
import { TimeReportGroupBy } from './dto/time-report.query.dto';

export interface CreateTimeEntryInput {
  workspaceId: string;
  actorUserId: string;
  taskId: string;
  durationMinutes: number;
  date: string;
  description?: string;
  billable?: boolean;
}

export interface UpdateTimeEntryInput {
  id: string;
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceRole;
  durationMinutes?: number;
  date?: string;
  description?: string | null;
  billable?: boolean;
}

export interface DeleteTimeEntryInput {
  id: string;
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceRole;
}

export interface ListTimeEntriesInput {
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceRole;
  userId?: string;
  taskId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  billable?: boolean;
}

export interface StartTimerInput {
  workspaceId: string;
  actorUserId: string;
  taskId: string;
  description?: string;
  billable?: boolean;
}

export interface ReportInput {
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceRole;
  groupBy: TimeReportGroupBy;
  dateFrom: string;
  dateTo: string;
  userId?: string;
  projectId?: string;
}

export interface ReportRow {
  groupKey: string;
  totalMinutes: number;
  entryCount: number;
}

export interface TaskTimeSummary {
  totalMinutes: number;
  entries: TimeEntryEntity[];
}

/**
 * Compute duration (rounded minutes, never negative) between two timestamps.
 * Exported for direct unit testing.
 */
export function computeDurationMinutes(startedAt: Date, stoppedAt: Date): number {
  const ms = stoppedAt.getTime() - startedAt.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.max(0, Math.round(ms / 60000));
}

/**
 * Workspace admins (OWNER / ADMIN) have full visibility & mutation rights
 * on every time entry; everyone else is constrained to their own rows.
 */
function isWorkspaceAdmin(role: WorkspaceRole): boolean {
  return hasAtLeastRole(role, WorkspaceRole.ADMIN);
}

@Injectable()
export class TimeEntryService {
  private readonly logger = new Logger(TimeEntryService.name);

  constructor(
    @InjectRepository(TimeEntryEntity)
    private readonly timeEntryRepo: Repository<TimeEntryEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async create(input: CreateTimeEntryInput): Promise<TimeEntryEntity> {
    const {
      workspaceId,
      actorUserId,
      taskId,
      durationMinutes,
      date,
      description,
      billable,
    } = input;

    await this.assertTaskInWorkspace(taskId, workspaceId);

    const entity = this.timeEntryRepo.create({
      workspaceId,
      taskId,
      userId: actorUserId,
      durationMinutes,
      date: new Date(date),
      description: description ?? null,
      billable: billable ?? true,
      startedAt: null,
      stoppedAt: null,
    });

    const saved = await this.timeEntryRepo.save(entity);

    this.eventBus.publish(
      new TimeEntryCreatedEvent({
        aggregateId: saved.id,
        aggregateType: 'TimeEntry',
        workspaceId,
        actorUserId,
        payload: {
          timeEntryId: saved.id,
          taskId: saved.taskId,
          userId: saved.userId,
          durationMinutes: saved.durationMinutes,
          date: this.formatDate(saved.date),
          billable: saved.billable,
          timerStarted: false,
        },
      }),
    );

    return saved;
  }

  async getById(id: string, workspaceId: string): Promise<TimeEntryEntity> {
    const entry = await this.timeEntryRepo.findOne({
      where: { id, workspaceId },
    });
    if (!entry) {
      throw new NotFoundException('TIME_ENTRY_NOT_FOUND');
    }
    return entry;
  }

  async update(input: UpdateTimeEntryInput): Promise<TimeEntryEntity> {
    const {
      id,
      workspaceId,
      actorUserId,
      actorRole,
      durationMinutes,
      date,
      description,
      billable,
    } = input;

    const entry = await this.getById(id, workspaceId);
    this.assertOwnerOrAdmin(entry, actorUserId, actorRole);

    const changes: Record<string, unknown> = {};

    if (durationMinutes !== undefined && durationMinutes !== entry.durationMinutes) {
      changes.durationMinutes = { from: entry.durationMinutes, to: durationMinutes };
      entry.durationMinutes = durationMinutes;
    }
    if (date !== undefined) {
      const newDate = new Date(date);
      if (newDate.getTime() !== entry.date.getTime()) {
        changes.date = {
          from: this.formatDate(entry.date),
          to: this.formatDate(newDate),
        };
        entry.date = newDate;
      }
    }
    if (description !== undefined && description !== entry.description) {
      changes.description = { from: entry.description, to: description };
      entry.description = description;
    }
    if (billable !== undefined && billable !== entry.billable) {
      changes.billable = { from: entry.billable, to: billable };
      entry.billable = billable;
    }

    const saved = await this.timeEntryRepo.save(entry);

    if (Object.keys(changes).length > 0) {
      this.eventBus.publish(
        new TimeEntryUpdatedEvent({
          aggregateId: saved.id,
          aggregateType: 'TimeEntry',
          workspaceId,
          actorUserId,
          payload: {
            timeEntryId: saved.id,
            taskId: saved.taskId,
            userId: saved.userId,
            changes,
            timerStopped: false,
          },
        }),
      );
    }

    return saved;
  }

  async delete(input: DeleteTimeEntryInput): Promise<void> {
    const { id, workspaceId, actorUserId, actorRole } = input;
    const entry = await this.getById(id, workspaceId);
    this.assertOwnerOrAdmin(entry, actorUserId, actorRole);

    await this.timeEntryRepo.softDelete(entry.id);

    this.eventBus.publish(
      new TimeEntryDeletedEvent({
        aggregateId: entry.id,
        aggregateType: 'TimeEntry',
        workspaceId,
        actorUserId,
        payload: {
          timeEntryId: entry.id,
          taskId: entry.taskId,
          userId: entry.userId,
          actorUserId,
        },
      }),
    );
  }

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------

  async list(input: ListTimeEntriesInput): Promise<TimeEntryEntity[]> {
    const {
      workspaceId,
      actorUserId,
      actorRole,
      userId,
      taskId,
      projectId,
      dateFrom,
      dateTo,
      billable,
    } = input;

    const qb = this.timeEntryRepo
      .createQueryBuilder('te')
      .where('te.workspaceId = :workspaceId', { workspaceId });

    // Visibility rule: non-admins are forced to see only their own entries.
    if (!isWorkspaceAdmin(actorRole)) {
      qb.andWhere('te.userId = :actorUserId', { actorUserId });
    } else if (userId) {
      qb.andWhere('te.userId = :userId', { userId });
    }

    if (taskId) {
      qb.andWhere('te.taskId = :taskId', { taskId });
    }

    if (projectId) {
      qb.andWhere(
        new Brackets((b) => {
          b.where(
            'te.taskId IN (SELECT t.id FROM tasks t WHERE t.project_id = :projectId)',
            { projectId },
          );
        }),
      );
    }

    if (dateFrom) {
      qb.andWhere('te.date >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('te.date <= :dateTo', { dateTo });
    }
    if (billable !== undefined) {
      qb.andWhere('te.billable = :billable', { billable });
    }

    qb.orderBy('te.date', 'DESC').addOrderBy('te.createdAt', 'DESC');

    return qb.getMany();
  }

  // -------------------------------------------------------------------------
  // Timer flow
  // -------------------------------------------------------------------------

  /**
   * Start a timer for the current user.
   *
   * Decision (documented): if the user already has an active timer, we
   * **auto-stop the previous one** and open a new one. This matches the
   * Toggl/Tempo UX where starting a new timer cleanly closes the previous
   * task without forcing the user to remember to stop it. The auto-stop
   * publishes a `TimeEntryUpdatedEvent` with `timerStopped: true` so listeners
   * (activity feed, realtime) can react.
   */
  async startTimer(input: StartTimerInput): Promise<TimeEntryEntity> {
    const { workspaceId, actorUserId, taskId, description, billable } = input;

    await this.assertTaskInWorkspace(taskId, workspaceId);

    // Auto-stop any pre-existing active timer (one-active-timer invariant).
    const existing = await this.getActiveTimer(actorUserId);
    if (existing) {
      await this.stopTimerEntry(existing, actorUserId);
    }

    const now = new Date();
    const entity = this.timeEntryRepo.create({
      workspaceId,
      taskId,
      userId: actorUserId,
      durationMinutes: 0,
      date: this.startOfDay(now),
      description: description ?? null,
      billable: billable ?? true,
      startedAt: now,
      stoppedAt: null,
    });

    const saved = await this.timeEntryRepo.save(entity);

    this.eventBus.publish(
      new TimeEntryCreatedEvent({
        aggregateId: saved.id,
        aggregateType: 'TimeEntry',
        workspaceId,
        actorUserId,
        payload: {
          timeEntryId: saved.id,
          taskId: saved.taskId,
          userId: saved.userId,
          durationMinutes: 0,
          date: this.formatDate(saved.date),
          billable: saved.billable,
          timerStarted: true,
        },
      }),
    );

    return saved;
  }

  async stopActiveTimer(
    workspaceId: string,
    actorUserId: string,
  ): Promise<TimeEntryEntity> {
    const active = await this.getActiveTimer(actorUserId);
    if (!active) {
      throw new NotFoundException('NO_ACTIVE_TIMER');
    }
    if (active.workspaceId !== workspaceId) {
      // Defensive — the timer belongs to a different workspace (the user
      // switched tenants mid-flight). Refuse to stop it from here.
      throw new ForbiddenException('TIMER_BELONGS_TO_OTHER_WORKSPACE');
    }
    return this.stopTimerEntry(active, actorUserId);
  }

  async getActiveTimer(userId: string): Promise<TimeEntryEntity | null> {
    return this.timeEntryRepo.findOne({
      where: {
        userId,
        startedAt: Not(IsNull()),
        stoppedAt: IsNull(),
      },
    });
  }

  private async stopTimerEntry(
    entry: TimeEntryEntity,
    actorUserId: string,
  ): Promise<TimeEntryEntity> {
    if (!entry.startedAt) {
      throw new BadRequestException('TIMER_NOT_STARTED');
    }
    const now = new Date();
    entry.stoppedAt = now;
    entry.durationMinutes = computeDurationMinutes(entry.startedAt, now);

    const saved = await this.timeEntryRepo.save(entry);

    this.eventBus.publish(
      new TimeEntryUpdatedEvent({
        aggregateId: saved.id,
        aggregateType: 'TimeEntry',
        workspaceId: saved.workspaceId,
        actorUserId,
        payload: {
          timeEntryId: saved.id,
          taskId: saved.taskId,
          userId: saved.userId,
          changes: {
            stoppedAt: this.formatDateTime(now),
            durationMinutes: saved.durationMinutes,
          },
          timerStopped: true,
        },
      }),
    );

    return saved;
  }

  // -------------------------------------------------------------------------
  // Reports & aggregates
  // -------------------------------------------------------------------------

  /**
   * Aggregate time entries with a SQL `GROUP BY`. Non-admins are forced to
   * report on their own data only — there is no way to bypass this from the
   * HTTP layer.
   */
  async report(input: ReportInput): Promise<ReportRow[]> {
    const {
      workspaceId,
      actorUserId,
      actorRole,
      groupBy,
      dateFrom,
      dateTo,
      userId,
      projectId,
    } = input;

    const groupExpr = this.groupExpression(groupBy);

    const qb = this.timeEntryRepo
      .createQueryBuilder('te')
      .select(`${groupExpr}`, 'groupKey')
      .addSelect('COALESCE(SUM(te.duration_minutes), 0)', 'totalMinutes')
      .addSelect('COUNT(*)', 'entryCount')
      .where('te.workspace_id = :workspaceId', { workspaceId })
      .andWhere('te.deleted_at IS NULL')
      .andWhere('te.date BETWEEN :dateFrom AND :dateTo', { dateFrom, dateTo });

    if (!isWorkspaceAdmin(actorRole)) {
      qb.andWhere('te.user_id = :actorUserId', { actorUserId });
    } else if (userId) {
      qb.andWhere('te.user_id = :userId', { userId });
    }

    if (projectId) {
      // Join via tasks to filter by project.
      qb.andWhere(
        'te.task_id IN (SELECT t.id FROM tasks t WHERE t.project_id = :projectId)',
        { projectId },
      );
    }

    qb.groupBy('"groupKey"').orderBy('"groupKey"', 'ASC');

    const raw = await qb.getRawMany<{
      groupKey: string | null;
      totalMinutes: string | number | null;
      entryCount: string | number | null;
    }>();

    return raw.map((r) => ({
      groupKey: r.groupKey ?? '',
      totalMinutes: Number(r.totalMinutes ?? 0),
      entryCount: Number(r.entryCount ?? 0),
    }));
  }

  /**
   * Sum of all (non-deleted) minutes logged against a single task.
   * Used by the task card UI to render a "logged: 4h 30m" badge.
   */
  async totalForTask(taskId: string, workspaceId: string): Promise<number> {
    const row = await this.timeEntryRepo
      .createQueryBuilder('te')
      .select('COALESCE(SUM(te.duration_minutes), 0)', 'total')
      .where('te.task_id = :taskId', { taskId })
      .andWhere('te.workspace_id = :workspaceId', { workspaceId })
      .andWhere('te.deleted_at IS NULL')
      .getRawOne<{ total: string | number | null }>();

    return Number(row?.total ?? 0);
  }

  /**
   * Per-day totals for a user across a date range — feeds the activity chart.
   */
  async totalForUserPerDay(
    userId: string,
    workspaceId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<Array<{ date: string; totalMinutes: number }>> {
    const raw = await this.timeEntryRepo
      .createQueryBuilder('te')
      .select('te.date::text', 'date')
      .addSelect('COALESCE(SUM(te.duration_minutes), 0)', 'totalMinutes')
      .where('te.user_id = :userId', { userId })
      .andWhere('te.workspace_id = :workspaceId', { workspaceId })
      .andWhere('te.deleted_at IS NULL')
      .andWhere('te.date BETWEEN :dateFrom AND :dateTo', { dateFrom, dateTo })
      .groupBy('te.date')
      .orderBy('te.date', 'ASC')
      .getRawMany<{ date: string; totalMinutes: string | number | null }>();

    return raw.map((r) => ({
      date: r.date,
      totalMinutes: Number(r.totalMinutes ?? 0),
    }));
  }

  /**
   * `{ totalMinutes, entries }` for a task. `entries` is filtered to only the
   * requester's own rows unless they're a workspace admin.
   */
  async summaryForTask(
    taskId: string,
    workspaceId: string,
    actorUserId: string,
    actorRole: WorkspaceRole,
  ): Promise<TaskTimeSummary> {
    await this.assertTaskInWorkspace(taskId, workspaceId);

    const totalMinutes = await this.totalForTask(taskId, workspaceId);

    const qb = this.timeEntryRepo
      .createQueryBuilder('te')
      .where('te.taskId = :taskId', { taskId })
      .andWhere('te.workspaceId = :workspaceId', { workspaceId });

    if (!isWorkspaceAdmin(actorRole)) {
      qb.andWhere('te.userId = :actorUserId', { actorUserId });
    }

    qb.orderBy('te.date', 'DESC').addOrderBy('te.createdAt', 'DESC');

    const entries = await qb.getMany();
    return { totalMinutes, entries };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private assertOwnerOrAdmin(
    entry: TimeEntryEntity,
    actorUserId: string,
    actorRole: WorkspaceRole,
  ): void {
    if (entry.userId === actorUserId) return;
    if (isWorkspaceAdmin(actorRole)) return;
    throw new ForbiddenException('FORBIDDEN_NOT_OWNER');
  }

  private async assertTaskInWorkspace(
    taskId: string,
    workspaceId: string,
  ): Promise<void> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, workspaceId },
      select: ['id'],
    });
    if (!task) {
      throw new NotFoundException('TASK_NOT_FOUND');
    }
  }

  private groupExpression(groupBy: TimeReportGroupBy): string {
    switch (groupBy) {
      case TimeReportGroupBy.USER:
        return 'te.user_id::text';
      case TimeReportGroupBy.TASK:
        return 'te.task_id::text';
      case TimeReportGroupBy.DATE:
        return 'te.date::text';
      case TimeReportGroupBy.PROJECT:
        // Resolve project through tasks.
        return '(SELECT t.project_id::text FROM tasks t WHERE t.id = te.task_id)';
      default: {
        // Exhaustiveness check — never falls through at runtime.
        const _exhaustive: never = groupBy;
        void _exhaustive;
        throw new BadRequestException('INVALID_GROUP_BY');
      }
    }
  }

  private startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
  }

  private formatDate(d: Date): string {
    // YYYY-MM-DD (UTC) — stable, locale-free.
    return d.toISOString().slice(0, 10);
  }

  private formatDateTime(d: Date): string {
    return d.toISOString();
  }
}
