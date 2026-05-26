export declare const DOMAIN_EVENTS: {
    readonly TASK_CREATED: "task.created";
    readonly TASK_UPDATED: "task.updated";
    readonly TASK_STATUS_CHANGED: "task.status_changed";
    readonly TASK_ASSIGNED: "task.assigned";
    readonly TASK_UNASSIGNED: "task.unassigned";
    readonly TASK_DELETED: "task.deleted";
    readonly COMMENT_ADDED: "comment.added";
    readonly COMMENT_EDITED: "comment.edited";
    readonly COMMENT_DELETED: "comment.deleted";
    readonly MENTION_CREATED: "mention.created";
    readonly ATTACHMENT_ADDED: "attachment.added";
    readonly ATTACHMENT_REMOVED: "attachment.removed";
    readonly NOTIFICATION_CREATED: "notification.created";
    readonly AUTOMATION_TRIGGERED: "automation.triggered";
    readonly AI_JOB_COMPLETED: "ai.job_completed";
};
export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];
