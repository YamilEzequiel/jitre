import { Test, TestingModule } from '@nestjs/testing';
import { NotificationListener } from './notification.listener';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { SettingsService } from '../settings/settings.service';
import { WorkspaceMemberAddedEvent } from '../events/events/workspace-member-added.event';
import { WorkspaceOwnershipTransferredEvent } from '../events/events/workspace-ownership-transferred.event';
import { MentionCreatedEvent } from '../events/events/mention-created.event';
import { TaskAssignedEvent } from '../task/events/task-assigned.event';
import { TaskDueSoonEvent } from '../task/events/task-due-soon.event';
import { TaskStatusChangedEvent } from '../task/events/task-status-changed.event';
import { TaskCompletedEvent } from '../task/events/task-completed.event';
import { ProjectMemberAddedEvent } from '../project/events/project-member-added.event';
import { NotificationType, WorkspaceRole } from '@jitre/shared';

const mockDispatcher = {
  dispatch: jest.fn(),
};

const mockSettingsService = {
  getNotificationSetting: jest.fn(),
};

describe('NotificationListener', () => {
  let listener: NotificationListener;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationListener,
        { provide: NotificationDispatcherService, useValue: mockDispatcher },
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();
    listener = module.get(NotificationListener);
  });

  describe('onWorkspaceMemberAdded', () => {
    it('dispatches WORKSPACE_INVITED to addedUserId', async () => {
      mockDispatcher.dispatch.mockResolvedValue(undefined);
      const event = new WorkspaceMemberAddedEvent({
        aggregateId: 'm-1',
        aggregateType: 'WorkspaceMembership',
        workspaceId: 'ws-1',
        actorUserId: 'u-actor',
        payload: { addedUserId: 'u-added', role: WorkspaceRole.MEMBER },
      });

      await listener.onWorkspaceMemberAdded(event);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'u-added',
          type: NotificationType.WORKSPACE_INVITED,
        }),
      );
    });
  });

  describe('onWorkspaceOwnershipTransferred', () => {
    it('dispatches WORKSPACE_OWNERSHIP_TRANSFERRED to newOwnerId', async () => {
      mockDispatcher.dispatch.mockResolvedValue(undefined);
      const event = new WorkspaceOwnershipTransferredEvent({
        aggregateId: 'ws-1',
        aggregateType: 'Workspace',
        workspaceId: 'ws-1',
        actorUserId: 'u-prev',
        payload: { previousOwnerId: 'u-prev', newOwnerId: 'u-new' },
      });

      await listener.onWorkspaceOwnershipTransferred(event);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'u-new',
          type: NotificationType.WORKSPACE_OWNERSHIP_TRANSFERRED,
        }),
      );
    });
  });

  describe('onMentionCreated', () => {
    it('dispatches MENTION to mentionedUserId', async () => {
      mockDispatcher.dispatch.mockResolvedValue(undefined);
      const event = new MentionCreatedEvent({
        aggregateId: 'mention-1',
        aggregateType: 'Mention',
        workspaceId: 'ws-1',
        actorUserId: 'u-actor',
        payload: {
          mentionedUserId: 'u-mentioned',
          sourceType: 'Comment',
          sourceId: 'c-1',
          excerpt: 'hey',
        },
      });

      await listener.onMentionCreated(event);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'u-mentioned',
          type: NotificationType.MENTION,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('swallows dispatcher errors and does not rethrow', async () => {
      mockDispatcher.dispatch.mockRejectedValue(new Error('Dispatcher failed'));
      const event = new WorkspaceMemberAddedEvent({
        aggregateId: 'm-1',
        aggregateType: 'WorkspaceMembership',
        workspaceId: 'ws-1',
        payload: { addedUserId: 'u-1', role: WorkspaceRole.MEMBER },
      });

      await expect(
        listener.onWorkspaceMemberAdded(event),
      ).resolves.toBeUndefined();
    });
  });

  // ── K3: Task + Project notification handlers ────────────────────────────────

  describe('onTaskAssigned', () => {
    it('dispatches TASK_ASSIGNED to assignee when setting is true', async () => {
      mockSettingsService.getNotificationSetting.mockResolvedValue(true);
      mockDispatcher.dispatch.mockResolvedValue(undefined);

      const event = new TaskAssignedEvent({
        aggregateId: 'task-1',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        actorUserId: 'u-actor',
        payload: {
          taskId: 'task-1',
          projectId: 'proj-1',
          assigneeUserId: 'u-assignee',
          assignedByUserId: 'u-actor',
        },
      });

      await listener.onTaskAssigned(event);

      expect(mockSettingsService.getNotificationSetting).toHaveBeenCalledWith(
        'u-assignee',
        'ws-1',
        'notification.task_assigned',
        true,
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'u-assignee',
          type: NotificationType.TASK_ASSIGNED,
        }),
      );
    });

    it('does NOT dispatch when notification.task_assigned is false', async () => {
      mockSettingsService.getNotificationSetting.mockResolvedValue(false);

      const event = new TaskAssignedEvent({
        aggregateId: 'task-1',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: {
          taskId: 'task-1',
          projectId: 'proj-1',
          assigneeUserId: 'u-assignee',
        },
      });

      await listener.onTaskAssigned(event);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('onTaskDueSoon', () => {
    it('dispatches TASK_DUE_SOON to each assignee when setting is true', async () => {
      mockSettingsService.getNotificationSetting.mockResolvedValue(true);
      mockDispatcher.dispatch.mockResolvedValue(undefined);

      const event = new TaskDueSoonEvent({
        aggregateId: 'task-2',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: {
          taskId: 'task-2',
          projectId: 'proj-1',
          dueDate: '2026-06-01',
          assigneeUserIds: ['u-1', 'u-2'],
        },
      });

      await listener.onTaskDueSoon(event);

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(2);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'u-1',
          type: NotificationType.TASK_DUE_SOON,
        }),
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'u-2',
          type: NotificationType.TASK_DUE_SOON,
        }),
      );
    });

    it('skips assignees where notification.task_due_soon is false', async () => {
      mockSettingsService.getNotificationSetting
        .mockResolvedValueOnce(false) // u-1 opted out
        .mockResolvedValueOnce(true); // u-2 opted in
      mockDispatcher.dispatch.mockResolvedValue(undefined);

      const event = new TaskDueSoonEvent({
        aggregateId: 'task-2',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: {
          taskId: 'task-2',
          projectId: 'proj-1',
          dueDate: '2026-06-01',
          assigneeUserIds: ['u-1', 'u-2'],
        },
      });

      await listener.onTaskDueSoon(event);

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: 'u-2' }),
      );
    });
  });

  describe('onTaskStatusChanged', () => {
    it('dispatches TASK_STATUS_CHANGED to each assignee when setting is true', async () => {
      mockSettingsService.getNotificationSetting.mockResolvedValue(true);
      mockDispatcher.dispatch.mockResolvedValue(undefined);

      const event = new TaskStatusChangedEvent({
        aggregateId: 'task-3',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: {
          taskId: 'task-3',
          projectId: 'proj-1',
          previousStatusId: 's-1',
          newStatusId: 's-2',
          newCategory: 'IN_PROGRESS',
          assigneeUserIds: ['u-1'],
        },
      });

      await listener.onTaskStatusChanged(event);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'u-1',
          type: NotificationType.TASK_STATUS_CHANGED,
        }),
      );
    });

    it('does NOT dispatch when assigneeUserIds is empty', async () => {
      mockSettingsService.getNotificationSetting.mockResolvedValue(true);

      const event = new TaskStatusChangedEvent({
        aggregateId: 'task-3',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: {
          taskId: 'task-3',
          projectId: 'proj-1',
          previousStatusId: 's-1',
          newStatusId: 's-2',
          newCategory: 'IN_PROGRESS',
          assigneeUserIds: [],
        },
      });

      await listener.onTaskStatusChanged(event);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('onTaskCompleted', () => {
    it('dispatches TASK_COMPLETED to each assignee when setting is true', async () => {
      mockSettingsService.getNotificationSetting.mockResolvedValue(true);
      mockDispatcher.dispatch.mockResolvedValue(undefined);

      const event = new TaskCompletedEvent({
        aggregateId: 'task-4',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: {
          taskId: 'task-4',
          projectId: 'proj-1',
          completedAt: '2026-05-23T10:00:00Z',
          assigneeUserIds: ['u-1', 'u-2'],
        },
      });

      await listener.onTaskCompleted(event);

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(2);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.TASK_COMPLETED,
        }),
      );
    });

    it('skips dispatch when notification.task_completed is false', async () => {
      mockSettingsService.getNotificationSetting.mockResolvedValue(false);

      const event = new TaskCompletedEvent({
        aggregateId: 'task-4',
        aggregateType: 'Task',
        workspaceId: 'ws-1',
        payload: {
          taskId: 'task-4',
          projectId: 'proj-1',
          completedAt: '2026-05-23T10:00:00Z',
          assigneeUserIds: ['u-1'],
        },
      });

      await listener.onTaskCompleted(event);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('onProjectMemberAdded', () => {
    it('dispatches PROJECT_MEMBER_ADDED to added user when setting is true', async () => {
      mockSettingsService.getNotificationSetting.mockResolvedValue(true);
      mockDispatcher.dispatch.mockResolvedValue(undefined);

      const event = new ProjectMemberAddedEvent({
        aggregateId: 'proj-1',
        aggregateType: 'Project',
        workspaceId: 'ws-1',
        actorUserId: 'u-actor',
        payload: {
          projectId: 'proj-1',
          userId: 'u-new-member',
          role: 'MEMBER',
        },
      });

      await listener.onProjectMemberAdded(event);

      expect(mockSettingsService.getNotificationSetting).toHaveBeenCalledWith(
        'u-new-member',
        'ws-1',
        'notification.project_member_added',
        true,
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'u-new-member',
          type: NotificationType.PROJECT_MEMBER_ADDED,
        }),
      );
    });

    it('does NOT dispatch when notification.project_member_added is false', async () => {
      mockSettingsService.getNotificationSetting.mockResolvedValue(false);

      const event = new ProjectMemberAddedEvent({
        aggregateId: 'proj-1',
        aggregateType: 'Project',
        workspaceId: 'ws-1',
        payload: {
          projectId: 'proj-1',
          userId: 'u-new-member',
          role: 'MEMBER',
        },
      });

      await listener.onProjectMemberAdded(event);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
});
