import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RealtimeEvent } from '@jitre/shared';
import { RealtimeGateway } from './realtime.gateway';
import { TaskCreatedEvent } from '../task/events/task-created.event';
import { TaskUpdatedEvent } from '../task/events/task-updated.event';
import { TaskStatusChangedEvent } from '../task/events/task-status-changed.event';
import { TaskAssignedEvent } from '../task/events/task-assigned.event';
import { TaskUnassignedEvent } from '../task/events/task-unassigned.event';
import { TaskCompletedEvent } from '../task/events/task-completed.event';
import { TaskDeletedEvent } from '../task/events/task-deleted.event';
import { ProjectCreatedEvent } from '../project/events/project-created.event';
import { ProjectUpdatedEvent } from '../project/events/project-updated.event';
import { ProjectArchivedEvent } from '../project/events/project-archived.event';
import { ProjectMemberAddedEvent } from '../project/events/project-member-added.event';
import { ProjectMemberRemovedEvent } from '../project/events/project-member-removed.event';
import { NotificationCreatedEvent } from '../notification/events/notification-created.event';
import { CommentCreatedEvent } from '../events/events/comment-created.event';
import { CommentUpdatedEvent } from '../events/events/comment-updated.event';
import { CommentDeletedEvent } from '../events/events/comment-deleted.event';

/** Minimal shape for task.reordered — no domain event class until Fase 9 */
interface TaskReorderedPayload {
  payload: { taskId: string; newOrder: number; projectId: string };
  workspaceId?: string;
}

@Injectable()
export class RealtimeListener {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly logger: Logger,
  ) {}

  @OnEvent('task.created')
  onTaskCreated(event: TaskCreatedEvent): void {
    try {
      const payload = {
        taskId: event.payload.taskId,
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
      };
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.TASK_CREATED,
        payload,
      );
      this.gateway.emitToRoom(
        `workspace:${payload.workspaceId}`,
        RealtimeEvent.TASK_CREATED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'task.created',
        err,
      });
    }
  }

  @OnEvent('task.updated')
  onTaskUpdated(event: TaskUpdatedEvent): void {
    try {
      const payload = {
        taskId: event.payload.taskId,
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
        changed: Object.keys(event.payload.changes),
      };
      this.gateway.emitToRoom(
        `task:${payload.taskId}`,
        RealtimeEvent.TASK_UPDATED,
        payload,
      );
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.TASK_UPDATED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'task.updated',
        err,
      });
    }
  }

  @OnEvent('task.status_changed')
  onTaskStatusChanged(event: TaskStatusChangedEvent): void {
    try {
      const payload = {
        taskId: event.payload.taskId,
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
        statusId: event.payload.newStatusId,
        previousStatusId: event.payload.previousStatusId,
      };
      this.gateway.emitToRoom(
        `task:${payload.taskId}`,
        RealtimeEvent.TASK_STATUS_CHANGED,
        payload,
      );
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.TASK_STATUS_CHANGED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'task.status_changed',
        err,
      });
    }
  }

  @OnEvent('task.assigned')
  onTaskAssigned(event: TaskAssignedEvent): void {
    try {
      const payload = {
        taskId: event.payload.taskId,
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
        assigneeUserId: event.payload.assigneeUserId,
      };
      this.gateway.emitToRoom(
        `task:${payload.taskId}`,
        RealtimeEvent.TASK_ASSIGNED,
        payload,
      );
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.TASK_ASSIGNED,
        payload,
      );
      this.gateway.emitToRoom(
        `user:${payload.assigneeUserId}`,
        RealtimeEvent.TASK_ASSIGNED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'task.assigned',
        err,
      });
    }
  }

  @OnEvent('task.unassigned')
  onTaskUnassigned(event: TaskUnassignedEvent): void {
    try {
      const payload = {
        taskId: event.payload.taskId,
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
        unassignedUserId: event.payload.assigneeUserId,
      };
      this.gateway.emitToRoom(
        `task:${payload.taskId}`,
        RealtimeEvent.TASK_UNASSIGNED,
        payload,
      );
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.TASK_UNASSIGNED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'task.unassigned',
        err,
      });
    }
  }

  @OnEvent('task.completed')
  onTaskCompleted(event: TaskCompletedEvent): void {
    try {
      const payload = {
        taskId: event.payload.taskId,
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
      };
      this.gateway.emitToRoom(
        `task:${payload.taskId}`,
        RealtimeEvent.TASK_COMPLETED,
        payload,
      );
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.TASK_COMPLETED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'task.completed',
        err,
      });
    }
  }

  @OnEvent('task.deleted')
  onTaskDeleted(event: TaskDeletedEvent): void {
    try {
      const payload = {
        taskId: event.payload.taskId,
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
      };
      this.gateway.emitToRoom(
        `task:${payload.taskId}`,
        RealtimeEvent.TASK_DELETED,
        payload,
      );
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.TASK_DELETED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'task.deleted',
        err,
      });
    }
  }

  @OnEvent('project.created')
  onProjectCreated(event: ProjectCreatedEvent): void {
    try {
      const payload = {
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
      };
      this.gateway.emitToRoom(
        `workspace:${payload.workspaceId}`,
        RealtimeEvent.PROJECT_CREATED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'project.created',
        err,
      });
    }
  }

  @OnEvent('project.updated')
  onProjectUpdated(event: ProjectUpdatedEvent): void {
    try {
      const payload = {
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
        changed: Object.keys(event.payload.changes),
      };
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.PROJECT_UPDATED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'project.updated',
        err,
      });
    }
  }

  @OnEvent('project.archived')
  onProjectArchived(event: ProjectArchivedEvent): void {
    try {
      const payload = {
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
      };
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.PROJECT_ARCHIVED,
        payload,
      );
      this.gateway.emitToRoom(
        `workspace:${payload.workspaceId}`,
        RealtimeEvent.PROJECT_ARCHIVED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'project.archived',
        err,
      });
    }
  }

  @OnEvent('project.member.added')
  onProjectMemberAdded(event: ProjectMemberAddedEvent): void {
    try {
      const payload = {
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
        userId: event.payload.userId,
      };
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.PROJECT_MEMBER_ADDED,
        payload,
      );
      this.gateway.emitToRoom(
        `user:${payload.userId}`,
        RealtimeEvent.PROJECT_MEMBER_ADDED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'project.member.added',
        err,
      });
    }
  }

  @OnEvent('project.member.removed')
  onProjectMemberRemoved(event: ProjectMemberRemovedEvent): void {
    try {
      const payload = {
        projectId: event.payload.projectId,
        workspaceId: event.workspaceId!,
        userId: event.payload.userId,
      };
      this.gateway.emitToRoom(
        `workspace:${payload.workspaceId}`,
        RealtimeEvent.PROJECT_MEMBER_REMOVED,
        payload,
      );
      this.gateway.emitToRoom(
        `user:${payload.userId}`,
        RealtimeEvent.PROJECT_MEMBER_REMOVED,
        payload,
      );

      // Kick the removed user from the project and its task rooms
      try {
        const server = this.gateway.server;
        if (server) {
          server
            .in(`user:${payload.userId}`)
            .socketsLeave([`project:${payload.projectId}`]);
        }
      } catch {
        // non-critical, no Redis in test env
      }
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'project.member.removed',
        err,
      });
    }
  }

  @OnEvent('notification.created')
  onNotificationCreated(event: NotificationCreatedEvent): void {
    try {
      const payload = {
        notificationId: event.payload.notificationId,
        type: event.payload.type,
        workspaceId: event.workspaceId!,
      };
      this.gateway.emitToRoom(
        `user:${event.payload.recipientUserId}`,
        RealtimeEvent.NOTIFICATION_CREATED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'notification.created',
        err,
      });
    }
  }

  /**
   * task.reordered — no domain event class exists yet (Fase 9 reorder UI).
   * Handler registered with string key so the enum value is covered.
   * Emitter lands in Fase 9; this stub ensures the listener is wired.
   */
  @OnEvent('task.reordered')
  onTaskReordered(event: TaskReorderedPayload): void {
    try {
      const payload = {
        taskId: event.payload.taskId,
        newOrder: event.payload.newOrder,
        projectId: event.payload.projectId,
      };
      this.gateway.emitToRoom(
        `project:${payload.projectId}`,
        RealtimeEvent.TASK_REORDERED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'task.reordered',
        err,
      });
    }
  }

  @OnEvent('comment.created')
  onCommentCreated(event: CommentCreatedEvent): void {
    try {
      const payload = {
        commentId: event.payload.commentId,
        contextId: event.payload.contextId,
        context: event.payload.context,
        taskId:
          event.payload.context === 'task' ? event.payload.contextId : undefined,
        projectId:
          event.payload.context === 'project' ? event.payload.contextId : undefined,
        workspaceId: event.workspaceId!,
      };
      // Route to the specific context room (task or project)
      const room =
        event.payload.context === 'task'
          ? `task:${event.payload.contextId}`
          : `project:${event.payload.contextId}`;
      this.gateway.emitToRoom(room, RealtimeEvent.COMMENT_CREATED, payload);
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'comment.created',
        err,
      });
    }
  }

  /**
   * comment.updated — payload does not carry contextId (no FK back to task/project
   * in CommentUpdatedPayload). Emits to workspace room as fallback so all workspace
   * members receive the event. Fase 8 can enrich the payload with contextId if needed.
   */
  @OnEvent('comment.updated')
  onCommentUpdated(event: CommentUpdatedEvent): void {
    try {
      const payload = {
        commentId: event.payload.commentId,
        workspaceId: event.workspaceId!,
      };
      this.gateway.emitToRoom(
        `workspace:${event.workspaceId!}`,
        RealtimeEvent.COMMENT_UPDATED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'comment.updated',
        err,
      });
    }
  }

  /**
   * comment.deleted — same routing constraint as comment.updated: payload lacks contextId.
   * Emits to workspace room as fallback.
   */
  @OnEvent('comment.deleted')
  onCommentDeleted(event: CommentDeletedEvent): void {
    try {
      const payload = {
        commentId: event.payload.commentId,
        workspaceId: event.workspaceId!,
      };
      this.gateway.emitToRoom(
        `workspace:${event.workspaceId!}`,
        RealtimeEvent.COMMENT_DELETED,
        payload,
      );
    } catch (err: unknown) {
      this.logger.error({
        event: 'realtime.relay.error',
        name: 'comment.deleted',
        err,
      });
    }
  }
}
