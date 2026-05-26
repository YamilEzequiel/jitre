/**
 * Cross-cutting domain event names used by the event bus (EventEmitter2 on
 * backend, WebSocket payload `event` field on frontend). Defined here so both
 * sides agree on the wire-format strings.
 */
export const DOMAIN_EVENTS = {
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_ASSIGNED: 'task.assigned',
  TASK_UNASSIGNED: 'task.unassigned',
  TASK_DELETED: 'task.deleted',
  COMMENT_ADDED: 'comment.added',
  COMMENT_EDITED: 'comment.edited',
  COMMENT_DELETED: 'comment.deleted',
  MENTION_CREATED: 'mention.created',
  ATTACHMENT_ADDED: 'attachment.added',
  ATTACHMENT_REMOVED: 'attachment.removed',
  NOTIFICATION_CREATED: 'notification.created',
  AUTOMATION_TRIGGERED: 'automation.triggered',
  AI_JOB_COMPLETED: 'ai.job_completed',
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];
