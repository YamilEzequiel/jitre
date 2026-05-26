import { NotificationType } from '../enums/notification-type.enum';
import { RealtimeEvent } from '../enums/realtime-event.enum';
export interface RealtimeEventPayloads {
    [RealtimeEvent.TASK_CREATED]: {
        taskId: string;
        projectId: string;
        workspaceId: string;
    };
    [RealtimeEvent.TASK_UPDATED]: {
        taskId: string;
        projectId: string;
        workspaceId: string;
        changed: string[];
    };
    [RealtimeEvent.TASK_STATUS_CHANGED]: {
        taskId: string;
        projectId: string;
        workspaceId: string;
        statusId: string;
        previousStatusId?: string;
    };
    [RealtimeEvent.TASK_ASSIGNED]: {
        taskId: string;
        projectId: string;
        workspaceId: string;
        assigneeUserId: string;
    };
    [RealtimeEvent.TASK_UNASSIGNED]: {
        taskId: string;
        projectId: string;
        workspaceId: string;
        unassignedUserId: string;
    };
    [RealtimeEvent.TASK_COMPLETED]: {
        taskId: string;
        projectId: string;
        workspaceId: string;
    };
    [RealtimeEvent.TASK_DELETED]: {
        taskId: string;
        projectId: string;
        workspaceId: string;
    };
    [RealtimeEvent.TASK_REORDERED]: {
        taskId: string;
        projectId: string;
        workspaceId?: string;
        newOrder?: number;
    };
    [RealtimeEvent.PROJECT_CREATED]: {
        projectId: string;
        workspaceId: string;
    };
    [RealtimeEvent.PROJECT_UPDATED]: {
        projectId: string;
        workspaceId: string;
        changed: string[];
    };
    [RealtimeEvent.PROJECT_ARCHIVED]: {
        projectId: string;
        workspaceId: string;
    };
    [RealtimeEvent.PROJECT_MEMBER_ADDED]: {
        projectId: string;
        workspaceId: string;
        userId: string;
    };
    [RealtimeEvent.PROJECT_MEMBER_REMOVED]: {
        projectId: string;
        workspaceId: string;
        userId: string;
    };
    [RealtimeEvent.COMMENT_CREATED]: {
        commentId: string;
        taskId?: string;
        projectId?: string;
        workspaceId: string;
    };
    [RealtimeEvent.COMMENT_UPDATED]: {
        commentId: string;
        taskId?: string;
        projectId?: string;
        workspaceId: string;
    };
    [RealtimeEvent.COMMENT_DELETED]: {
        commentId: string;
        taskId?: string;
        projectId?: string;
        workspaceId: string;
    };
    [RealtimeEvent.NOTIFICATION_CREATED]: {
        notificationId: string;
        type: NotificationType;
        workspaceId: string;
    };
}
