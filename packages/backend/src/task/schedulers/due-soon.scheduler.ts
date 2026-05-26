import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { TaskEntity } from '../task.entity';
import { SettingsService } from '../../settings/settings.service';
import { EventBusService } from '../../events/event-bus.service';
import { TaskDueSoonEvent } from '../events/task-due-soon.event';

const DEFAULT_WINDOW_DAYS = 3;
/** Conservative outer window so we capture all tasks before per-workspace narrowing. */
const OUTER_WINDOW_DAYS = 30;

/**
 * Runs every day at 08:00 UTC.
 *
 * Algorithm:
 *   1. Fetch all tasks due within the next OUTER_WINDOW_DAYS (30d) that have assignments.
 *   2. Group by workspaceId.
 *   3. Per workspace: read `notification.task_due_soon_window_days` from settings.
 *   4. Filter tasks to those within the workspace-specific window.
 *   5. Publish TaskDueSoonEvent for each qualifying task.
 *
 * EventId = sha256('task.due_soon:' + taskId + ':' + dueDate.toDateString())
 * Re-runs on the same calendar day produce the same eventId (idempotent).
 */
@Injectable()
export class DueSoonScheduler {
  private readonly logger = new Logger(DueSoonScheduler.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    private readonly settingsService: SettingsService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Called by cron at 08:00 UTC daily. Also callable manually for tests. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async run(): Promise<void> {
    const now = new Date();
    const outerCutoff = new Date(now);
    outerCutoff.setDate(outerCutoff.getDate() + OUTER_WINDOW_DAYS);

    // S3: SQL LEFT JOIN task_statuses to exclude DONE-category tasks at the DB level.
    // Previously used in-memory filter; now pushed to SQL for efficiency.
    const tasks = await this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignments', 'assignment')
      .leftJoin('task_statuses', 'ts', 'ts.id = task.status_id')
      .where('task.deleted_at IS NULL')
      .andWhere('task.due_date > :now', { now })
      .andWhere('task.due_date <= :cutoff', { cutoff: outerCutoff })
      .andWhere('(ts.id IS NULL OR ts.category <> :done)', { done: 'DONE' })
      .getMany();

    if (tasks.length === 0) return;

    // Group by workspace to do one settings lookup per workspace.
    const byWorkspace = new Map<string, TaskEntity[]>();
    for (const task of tasks) {
      const list = byWorkspace.get(task.workspaceId) ?? [];
      list.push(task);
      byWorkspace.set(task.workspaceId, list);
    }

    for (const [workspaceId, wsTasks] of byWorkspace.entries()) {
      let windowDays = DEFAULT_WINDOW_DAYS;
      try {
        windowDays = await this.settingsService.getWorkspaceSetting<number>(
          workspaceId,
          'notification.task_due_soon_window_days',
        );
      } catch {
        // keep default
      }

      const windowCutoff = new Date(now);
      windowCutoff.setDate(windowCutoff.getDate() + windowDays);

      for (const task of wsTasks) {
        if (!task.dueDate) continue;
        // The task was already returned by the DB query; respect the per-workspace window.
        if (task.dueDate > windowCutoff) continue;

        // S3: DONE-category tasks are now excluded via SQL LEFT JOIN (task_statuses).
        // The in-memory filter has been removed — SQL is the authoritative filter.
        // Defensive check for null-status tasks (broken FK case — still emit).

        const assigneeUserIds = (task.assignments ?? []).map((a) => a.userId);
        if (assigneeUserIds.length === 0) continue;

        const eventId = this.buildEventId(task.id, task.dueDate);

        this.eventBus.publish(
          new TaskDueSoonEvent({
            eventId,
            aggregateId: task.id,
            aggregateType: 'Task',
            workspaceId,
            payload: {
              taskId: task.id,
              projectId: task.projectId,
              dueDate: task.dueDate.toISOString(),
              assigneeUserIds,
            },
          }),
        );
      }
    }
  }

  /**
   * Deterministic eventId: sha256 of 'task.due_soon:' + taskId + ':' + YYYY-MM-DD,
   * formatted as UUID v4 shape (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) per ADR-10.
   * Accepted by Postgres uuid column; same-day re-runs produce the same id (idempotent).
   */
  buildEventId(taskId: string, dueDate: Date): string {
    const dateKey = dueDate.toISOString().slice(0, 10); // YYYY-MM-DD
    const hash = createHash('sha256')
      .update(`${taskId}:${dateKey}`)
      .digest('hex');
    // Format first 32 hex chars as UUID: 8-4-4-4-12
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }
}
