import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@jitre/shared';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { SettingsService } from '../settings/settings.service';
import type { WorkspaceMemberAddedEvent } from '../events/events/workspace-member-added.event';
import type { WorkspaceOwnershipTransferredEvent } from '../events/events/workspace-ownership-transferred.event';
import type { MentionCreatedEvent } from '../events/events/mention-created.event';
import type { TaskAssignedEvent } from '../task/events/task-assigned.event';
import type { TaskDueSoonEvent } from '../task/events/task-due-soon.event';
import type { TaskStatusChangedEvent } from '../task/events/task-status-changed.event';
import type { TaskCompletedEvent } from '../task/events/task-completed.event';
import type { ProjectMemberAddedEvent } from '../project/events/project-member-added.event';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly settingsService: SettingsService,
  ) {}

  @OnEvent('workspace.member.added')
  async onWorkspaceMemberAdded(
    event: WorkspaceMemberAddedEvent,
  ): Promise<void> {
    try {
      await this.dispatcher.dispatch({
        workspaceId: event.workspaceId!,
        recipientUserId: event.payload.addedUserId,
        type: NotificationType.WORKSPACE_INVITED,
        title: 'You were added to a workspace',
        data: { workspaceId: event.workspaceId, role: event.payload.role },
      });
    } catch (err) {
      this.logger.error(
        { eventId: event.eventId, err },
        'NotificationListener.onWorkspaceMemberAdded failed',
      );
    }
  }

  @OnEvent('workspace.ownership.transferred')
  async onWorkspaceOwnershipTransferred(
    event: WorkspaceOwnershipTransferredEvent,
  ): Promise<void> {
    try {
      await this.dispatcher.dispatch({
        workspaceId: event.workspaceId!,
        recipientUserId: event.payload.newOwnerId,
        type: NotificationType.WORKSPACE_OWNERSHIP_TRANSFERRED,
        title: 'Workspace ownership transferred to you',
      });
    } catch (err) {
      this.logger.error(
        { eventId: event.eventId, err },
        'NotificationListener.onWorkspaceOwnershipTransferred failed',
      );
    }
  }

  @OnEvent('mention.created')
  async onMentionCreated(event: MentionCreatedEvent): Promise<void> {
    try {
      await this.dispatcher.dispatch({
        workspaceId: event.workspaceId!,
        recipientUserId: event.payload.mentionedUserId,
        type: NotificationType.MENTION,
        title: 'You were mentioned',
        data: {
          sourceType: event.payload.sourceType,
          sourceId: event.payload.sourceId,
          excerpt: event.payload.excerpt,
        },
      });
    } catch (err) {
      this.logger.error(
        { eventId: event.eventId, err },
        'NotificationListener.onMentionCreated failed',
      );
    }
  }

  // ── K3: Task + Project notification handlers ────────────────────────────────

  @OnEvent('task.assigned')
  async onTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    try {
      const { assigneeUserId } = event.payload;
      const enabled = await this.settingsService.getNotificationSetting(
        assigneeUserId,
        event.workspaceId!,
        'notification.task_assigned',
        true,
      );
      if (!enabled) return;

      await this.dispatcher.dispatch({
        workspaceId: event.workspaceId!,
        recipientUserId: assigneeUserId,
        type: NotificationType.TASK_ASSIGNED,
        title: 'A task was assigned to you',
        data: {
          taskId: event.payload.taskId,
          projectId: event.payload.projectId,
        },
      });
    } catch (err) {
      this.logger.error(
        { eventId: event.eventId, err },
        'NotificationListener.onTaskAssigned failed',
      );
    }
  }

  @OnEvent('task.due_soon')
  async onTaskDueSoon(event: TaskDueSoonEvent): Promise<void> {
    const { assigneeUserIds, taskId, projectId, dueDate } = event.payload;
    for (const userId of assigneeUserIds) {
      try {
        const enabled = await this.settingsService.getNotificationSetting(
          userId,
          event.workspaceId!,
          'notification.task_due_soon',
          true,
        );
        if (!enabled) continue;

        await this.dispatcher.dispatch({
          workspaceId: event.workspaceId!,
          recipientUserId: userId,
          type: NotificationType.TASK_DUE_SOON,
          title: 'A task is due soon',
          data: { taskId, projectId, dueDate },
        });
      } catch (err) {
        this.logger.error(
          { eventId: event.eventId, userId, err },
          'NotificationListener.onTaskDueSoon failed for one recipient',
        );
      }
    }
  }

  @OnEvent('task.status_changed')
  async onTaskStatusChanged(event: TaskStatusChangedEvent): Promise<void> {
    const {
      assigneeUserIds = [],
      taskId,
      projectId,
      newStatusId,
    } = event.payload;
    for (const userId of assigneeUserIds) {
      try {
        const enabled = await this.settingsService.getNotificationSetting(
          userId,
          event.workspaceId!,
          'notification.task_status_changed',
          true,
        );
        if (!enabled) continue;

        await this.dispatcher.dispatch({
          workspaceId: event.workspaceId!,
          recipientUserId: userId,
          type: NotificationType.TASK_STATUS_CHANGED,
          title: 'Task status changed',
          data: { taskId, projectId, newStatusId },
        });
      } catch (err) {
        this.logger.error(
          { eventId: event.eventId, userId, err },
          'NotificationListener.onTaskStatusChanged failed for one recipient',
        );
      }
    }
  }

  @OnEvent('task.completed')
  async onTaskCompleted(event: TaskCompletedEvent): Promise<void> {
    const {
      assigneeUserIds = [],
      taskId,
      projectId,
      completedAt,
    } = event.payload;
    for (const userId of assigneeUserIds) {
      try {
        const enabled = await this.settingsService.getNotificationSetting(
          userId,
          event.workspaceId!,
          'notification.task_completed',
          true,
        );
        if (!enabled) continue;

        await this.dispatcher.dispatch({
          workspaceId: event.workspaceId!,
          recipientUserId: userId,
          type: NotificationType.TASK_COMPLETED,
          title: 'Task completed',
          data: { taskId, projectId, completedAt },
        });
      } catch (err) {
        this.logger.error(
          { eventId: event.eventId, userId, err },
          'NotificationListener.onTaskCompleted failed for one recipient',
        );
      }
    }
  }

  @OnEvent('project.member.added')
  async onProjectMemberAdded(event: ProjectMemberAddedEvent): Promise<void> {
    try {
      const { userId, projectId, role } = event.payload;
      const enabled = await this.settingsService.getNotificationSetting(
        userId,
        event.workspaceId!,
        'notification.project_member_added',
        true,
      );
      if (!enabled) return;

      await this.dispatcher.dispatch({
        workspaceId: event.workspaceId!,
        recipientUserId: userId,
        type: NotificationType.PROJECT_MEMBER_ADDED,
        title: 'You were added to a project',
        data: { projectId, role },
      });
    } catch (err) {
      this.logger.error(
        { eventId: event.eventId, err },
        'NotificationListener.onProjectMemberAdded failed',
      );
    }
  }
}
