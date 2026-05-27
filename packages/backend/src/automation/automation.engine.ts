import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ModuleRef } from '@nestjs/core';
import {
  AutomationAction,
  AutomationCondition,
  AutomationEntity,
  AutomationTrigger,
} from './automation.entity';
import { AutomationService } from './automation.service';

/**
 * Listens to domain events and executes matching automations.
 *
 * Design:
 * - Each trigger maps 1-to-1 to a domain event name (`task.created`,
 *   `task.status_changed`, ...). The @OnEvent handlers are tiny dispatchers
 *   that forward to `run(trigger, payload)`.
 * - Conditions are evaluated against the merged context built from the
 *   event payload + the loaded task (when needed).
 * - Actions are looked up by `type` against a registry of side-effect
 *   functions resolved at runtime via ModuleRef. This avoids a hard import
 *   loop with TaskService / NotificationService that would otherwise pull
 *   the entire app into AutomationModule's compile graph.
 * - Every action set is logged to automation_runs (success | error | skipped).
 */
@Injectable()
export class AutomationEngine {
  private readonly logger = new Logger(AutomationEngine.name);

  constructor(
    private readonly service: AutomationService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @OnEvent('task.created')
  async onTaskCreated(payload: { workspaceId: string; payload: Record<string, unknown> }): Promise<void> {
    await this.run('task.created', payload);
  }

  @OnEvent('task.status_changed')
  async onStatusChanged(payload: { workspaceId: string; payload: Record<string, unknown> }): Promise<void> {
    await this.run('task.status_changed', payload);
  }

  @OnEvent('task.assigned')
  async onAssigned(payload: { workspaceId: string; payload: Record<string, unknown> }): Promise<void> {
    await this.run('task.assigned', payload);
  }

  @OnEvent('task.priority_changed')
  async onPriorityChanged(payload: { workspaceId: string; payload: Record<string, unknown> }): Promise<void> {
    await this.run('task.priority_changed', payload);
  }

  @OnEvent('task.due_soon')
  async onDueSoon(payload: { workspaceId: string; payload: Record<string, unknown> }): Promise<void> {
    await this.run('task.due_soon', payload);
  }

  private async run(
    trigger: AutomationTrigger,
    event: { workspaceId: string; payload: Record<string, unknown> },
  ): Promise<void> {
    const workspaceId = event.workspaceId;
    if (!workspaceId) return;
    let automations: AutomationEntity[];
    try {
      automations = await this.service.findActiveByTrigger(workspaceId, trigger);
    } catch (err) {
      this.logger.error(`automation lookup failed for ${trigger}`, err);
      return;
    }
    if (automations.length === 0) return;

    for (const automation of automations) {
      // Scope by project — payload should carry projectId for task events.
      const eventProjectId = event.payload?.['projectId'] as string | undefined;
      if (eventProjectId && automation.projectId !== eventProjectId) continue;

      const context = { ...(event.payload ?? {}) };
      if (!this.matchesConditions(automation.conditions ?? [], context)) {
        await this.service.logRun({
          automationId: automation.id,
          workspaceId,
          status: 'skipped',
          context,
        });
        continue;
      }

      try {
        for (const action of automation.actions) {
          await this.executeAction(action, { ...context, workspaceId });
        }
        await this.service.logRun({
          automationId: automation.id,
          workspaceId,
          status: 'success',
          context,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`automation ${automation.id} failed: ${message}`);
        await this.service.logRun({
          automationId: automation.id,
          workspaceId,
          status: 'error',
          context,
          error: message,
        });
      }
    }
  }

  private matchesConditions(
    conditions: AutomationCondition[],
    context: Record<string, unknown>,
  ): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((c) => {
      const actual = (context as Record<string, unknown>)[c.field];
      switch (c.op) {
        case 'eq':
          return actual === c.value;
        case 'neq':
          return actual !== c.value;
        case 'in':
          return Array.isArray(c.value) && (c.value as unknown[]).includes(actual);
        case 'not_in':
          return Array.isArray(c.value) && !(c.value as unknown[]).includes(actual);
        case 'changed_to': {
          // payload from status_changed has both previous + new ids
          const current = (context['statusId'] ?? context['toStatusId']) as unknown;
          return current === c.value;
        }
        case 'changed_from': {
          const prev = (context['previousStatusId'] ?? context['fromStatusId']) as unknown;
          return prev === c.value;
        }
        default:
          return false;
      }
    });
  }

  /**
   * Action dispatcher. Each branch resolves the service it needs at runtime
   * to avoid pulling them into AutomationModule's compile-time import set.
   */
  private async executeAction(
    action: AutomationAction,
    context: Record<string, unknown>,
  ): Promise<void> {
    const taskId = context['taskId'] as string | undefined;
    const workspaceId = context['workspaceId'] as string;
    const actorUserId = (context['actorUserId'] as string) ?? null;

    switch (action.type) {
      case 'assign_to_user': {
        if (!taskId) return;
        const userId = action.params['userId'] as string | undefined;
        if (!userId) return;
        const assignmentService = await this.lazy<{
          assign: (taskId: string, userId: string, actorUserId?: string) => Promise<unknown>;
        }>('TaskAssignmentService');
        if (assignmentService) {
          await assignmentService.assign(taskId, userId, actorUserId ?? undefined);
        }
        return;
      }
      case 'set_priority': {
        if (!taskId) return;
        const priority = action.params['priority'] as string | undefined;
        if (!priority) return;
        const taskService = await this.lazy<{
          update: (id: string, dto: Record<string, unknown>) => Promise<unknown>;
        }>('TaskService');
        if (taskService) await taskService.update(taskId, { priority });
        return;
      }
      case 'set_status': {
        if (!taskId) return;
        const statusId = action.params['statusId'] as string | undefined;
        if (!statusId) return;
        const taskService = await this.lazy<{
          changeStatus: (id: string, statusId: string, actorUserId?: string) => Promise<unknown>;
        }>('TaskService');
        if (taskService) {
          await taskService.changeStatus(taskId, statusId, actorUserId ?? undefined);
        }
        return;
      }
      case 'add_label': {
        if (!taskId) return;
        const labelId = action.params['labelId'] as string | undefined;
        if (!labelId) return;
        const labelService = await this.lazy<{
          addLabel: (taskId: string, labelId: string) => Promise<unknown>;
        }>('TaskLabelService');
        if (labelService) await labelService.addLabel(taskId, labelId);
        return;
      }
      case 'add_comment': {
        if (!taskId) return;
        const body = action.params['body'] as string | undefined;
        if (!body) return;
        const commentService = await this.lazy<{
          create: (input: Record<string, unknown>) => Promise<unknown>;
        }>('CommentService');
        if (commentService) {
          await commentService.create({
            workspaceId,
            taskId,
            body,
            actorUserId,
          });
        }
        return;
      }
      case 'notify_user': {
        const userId = action.params['userId'] as string | undefined;
        if (!userId) return;
        const message =
          (action.params['message'] as string) ??
          (taskId ? `Automation fired on task ${taskId}` : 'Automation fired');
        const notificationService = await this.lazy<{
          create: (input: Record<string, unknown>) => Promise<unknown>;
        }>('NotificationService');
        if (notificationService) {
          await notificationService.create({
            workspaceId,
            userId,
            message,
            type: 'automation',
            subjectId: taskId ?? null,
            subjectType: 'Task',
          });
        }
        return;
      }
      default:
        this.logger.warn(`Unknown action type: ${(action as { type: string }).type}`);
    }
  }

  /** Lazy ModuleRef.get with `{ strict: false }` so we cross module borders. */
  private async lazy<T>(token: string): Promise<T | null> {
    try {
      return this.moduleRef.get<T>(token, { strict: false });
    } catch {
      return null;
    }
  }
}
