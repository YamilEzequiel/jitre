import { Logger } from '@nestjs/common';
import { RealtimeListener } from './realtime.listener';
import { RealtimeEvent, NotificationType } from '@jitre/shared';
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

const makeGateway = () => ({
  emitToRoom: jest.fn(),
  server: {
    in: jest.fn().mockReturnValue({ socketsLeave: jest.fn() }),
  },
});

describe('RealtimeListener', () => {
  let listener: RealtimeListener;
  let gateway: ReturnType<typeof makeGateway>;
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = makeGateway();
    listener = new RealtimeListener(gateway as never, mockLogger);
  });

  describe('onTaskCreated', () => {
    it('emits to project: and workspace: rooms', () => {
      const event = new TaskCreatedEvent({
        aggregateId: 'task-1',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: { taskId: 'task-1', projectId: 'p-1', title: 'Task 1' },
      });

      listener.onTaskCreated(event);

      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'project:p-1',
        RealtimeEvent.TASK_CREATED,
        expect.objectContaining({
          taskId: 'task-1',
          projectId: 'p-1',
          workspaceId: 'ws-1',
        }),
      );
      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'workspace:ws-1',
        RealtimeEvent.TASK_CREATED,
        expect.objectContaining({ workspaceId: 'ws-1' }),
      );
    });
  });

  describe('onTaskUpdated', () => {
    it('emits TASK_UPDATED to task: and project: rooms', () => {
      const event = new TaskUpdatedEvent({
        aggregateId: 'task-1',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: {
          taskId: 'task-1',
          projectId: 'p-1',
          changes: { title: 'new' },
        },
      });

      listener.onTaskUpdated(event);

      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'task:task-1',
        RealtimeEvent.TASK_UPDATED,
        expect.objectContaining({ taskId: 'task-1' }),
      );
    });
  });

  describe('onTaskAssigned', () => {
    it('emits TASK_ASSIGNED to task:, project:, and user:<assignee> rooms', () => {
      const event = new TaskAssignedEvent({
        aggregateId: 'task-1',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: { taskId: 'task-1', projectId: 'p-1', assigneeUserId: 'u-1' },
      });

      listener.onTaskAssigned(event);

      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'user:u-1',
        RealtimeEvent.TASK_ASSIGNED,
        expect.objectContaining({ assigneeUserId: 'u-1' }),
      );
    });
  });

  describe('onNotificationCreated', () => {
    it('emits NOTIFICATION_CREATED to user:<recipientUserId> room', () => {
      const event = new NotificationCreatedEvent({
        aggregateId: 'notif-1',
        aggregateType: 'Notification',
        workspaceId: 'ws-1',
        payload: {
          notificationId: 'notif-1',
          recipientUserId: 'u-recipient',
          type: NotificationType.WORKSPACE_INVITED,
        },
      });

      listener.onNotificationCreated(event);

      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'user:u-recipient',
        RealtimeEvent.NOTIFICATION_CREATED,
        expect.objectContaining({
          notificationId: 'notif-1',
          type: NotificationType.WORKSPACE_INVITED,
          workspaceId: 'ws-1',
        }),
      );
    });
  });

  describe('onProjectMemberRemoved', () => {
    it('calls server.in(user:<id>).socketsLeave for project rooms', () => {
      const event = new ProjectMemberRemovedEvent({
        aggregateId: 'p-1',
        aggregateType: 'Project',
        workspaceId: 'ws-1',
        payload: { projectId: 'p-1', userId: 'u-removed' },
      });

      listener.onProjectMemberRemoved(event);

      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'workspace:ws-1',
        RealtimeEvent.PROJECT_MEMBER_REMOVED,
        expect.objectContaining({ projectId: 'p-1', userId: 'u-removed' }),
      );
    });
  });

  describe('error swallowing', () => {
    it('swallows errors inside handlers and does not propagate', () => {
      gateway.emitToRoom.mockImplementationOnce(() => {
        throw new Error('emit failed');
      });

      const event = new TaskCreatedEvent({
        aggregateId: 'task-err',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: { taskId: 'task-err', projectId: 'p-1', title: 'T' },
      });

      expect(() => listener.onTaskCreated(event)).not.toThrow();
    });
  });

  describe('remaining event handlers', () => {
    it('onTaskStatusChanged emits TASK_STATUS_CHANGED', () => {
      const event = new TaskStatusChangedEvent({
        aggregateId: 't-1',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: {
          taskId: 't-1',
          projectId: 'p-1',
          previousStatusId: 's-0',
          newStatusId: 's-1',
          newCategory: 'IN_PROGRESS',
        },
      });
      listener.onTaskStatusChanged(event);
      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        expect.stringContaining('task:'),
        RealtimeEvent.TASK_STATUS_CHANGED,
        expect.any(Object),
      );
    });

    it('onTaskUnassigned emits TASK_UNASSIGNED', () => {
      const event = new TaskUnassignedEvent({
        aggregateId: 't-1',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: { taskId: 't-1', projectId: 'p-1', assigneeUserId: 'u-1' },
      });
      listener.onTaskUnassigned(event);
      expect(gateway.emitToRoom).toHaveBeenCalled();
    });

    it('onTaskCompleted emits TASK_COMPLETED', () => {
      const event = new TaskCompletedEvent({
        aggregateId: 't-1',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: {
          taskId: 't-1',
          projectId: 'p-1',
          completedAt: '2026-05-23T00:00:00Z',
        },
      });
      listener.onTaskCompleted(event);
      expect(gateway.emitToRoom).toHaveBeenCalled();
    });

    it('onTaskDeleted emits TASK_DELETED', () => {
      const event = new TaskDeletedEvent({
        aggregateId: 't-1',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: { taskId: 't-1', projectId: 'p-1' },
      });
      listener.onTaskDeleted(event);
      expect(gateway.emitToRoom).toHaveBeenCalled();
    });

    it('onProjectCreated emits PROJECT_CREATED', () => {
      const event = new ProjectCreatedEvent({
        aggregateId: 'p-1',
        aggregateType: 'Project',
        workspaceId: 'ws-1',
        payload: { projectId: 'p-1', name: 'P', key: 'P', ownerUserId: 'u-1' },
      });
      listener.onProjectCreated(event);
      expect(gateway.emitToRoom).toHaveBeenCalled();
    });

    it('onProjectUpdated emits PROJECT_UPDATED', () => {
      const event = new ProjectUpdatedEvent({
        aggregateId: 'p-1',
        aggregateType: 'Project',
        workspaceId: 'ws-1',
        payload: { projectId: 'p-1', changes: {} },
      });
      listener.onProjectUpdated(event);
      expect(gateway.emitToRoom).toHaveBeenCalled();
    });

    it('onProjectArchived emits PROJECT_ARCHIVED', () => {
      const event = new ProjectArchivedEvent({
        aggregateId: 'p-1',
        aggregateType: 'Project',
        workspaceId: 'ws-1',
        payload: { projectId: 'p-1' },
      });
      listener.onProjectArchived(event);
      expect(gateway.emitToRoom).toHaveBeenCalled();
    });

    it('onProjectMemberAdded emits PROJECT_MEMBER_ADDED', () => {
      const event = new ProjectMemberAddedEvent({
        aggregateId: 'p-1',
        aggregateType: 'Project',
        workspaceId: 'ws-1',
        payload: { projectId: 'p-1', userId: 'u-1', role: 'MEMBER' },
      });
      listener.onProjectMemberAdded(event);
      expect(gateway.emitToRoom).toHaveBeenCalled();
    });
  });

  describe('W2 — handlers added post-verify', () => {
    it('onTaskReordered emits TASK_REORDERED to project: room', () => {
      // task.reordered has no domain event class yet (Fase 9) — handler uses string key
      listener.onTaskReordered({
        payload: { taskId: 't-1', newOrder: 2, projectId: 'p-1' },
        workspaceId: 'ws-1',
      });

      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'project:p-1',
        RealtimeEvent.TASK_REORDERED,
        expect.objectContaining({
          taskId: 't-1',
          newOrder: 2,
          projectId: 'p-1',
        }),
      );
    });

    it('onCommentCreated emits COMMENT_CREATED to task: room when context=task', () => {
      const event = new CommentCreatedEvent({
        aggregateId: 'c-1',
        aggregateType: 'Comment',
        workspaceId: 'ws-1',
        payload: {
          commentId: 'c-1',
          contextId: 'task-1',
          context: 'task',
          authorUserId: 'u-1',
          body: 'hello',
          mentionedUserIds: [],
        },
      });
      listener.onCommentCreated(event);
      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'task:task-1',
        RealtimeEvent.COMMENT_CREATED,
        expect.objectContaining({ commentId: 'c-1', contextId: 'task-1' }),
      );
    });

    it('onCommentCreated emits COMMENT_CREATED to project: room when context=project', () => {
      const event = new CommentCreatedEvent({
        aggregateId: 'c-2',
        aggregateType: 'Comment',
        workspaceId: 'ws-1',
        payload: {
          commentId: 'c-2',
          contextId: 'proj-1',
          context: 'project',
          authorUserId: 'u-1',
          body: 'hello',
          mentionedUserIds: [],
        },
      });
      listener.onCommentCreated(event);
      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'project:proj-1',
        RealtimeEvent.COMMENT_CREATED,
        expect.objectContaining({ commentId: 'c-2', contextId: 'proj-1' }),
      );
    });

    it('onCommentUpdated emits COMMENT_UPDATED to workspace: room', () => {
      const event = new CommentUpdatedEvent({
        aggregateId: 'c-1',
        aggregateType: 'Comment',
        workspaceId: 'ws-1',
        payload: {
          commentId: 'c-1',
          previousBody: 'old',
          newBody: 'new',
          mentionedUserIds: [],
        },
      });
      listener.onCommentUpdated(event);
      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'workspace:ws-1',
        RealtimeEvent.COMMENT_UPDATED,
        expect.objectContaining({ commentId: 'c-1' }),
      );
    });

    it('onCommentDeleted emits COMMENT_DELETED to workspace: room', () => {
      const event = new CommentDeletedEvent({
        aggregateId: 'c-1',
        aggregateType: 'Comment',
        workspaceId: 'ws-1',
        payload: { commentId: 'c-1', actorUserId: 'u-1' },
      });
      listener.onCommentDeleted(event);
      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'workspace:ws-1',
        RealtimeEvent.COMMENT_DELETED,
        expect.objectContaining({ commentId: 'c-1' }),
      );
    });
  });
});
