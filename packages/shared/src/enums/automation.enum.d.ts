export declare enum AutomationTriggerType {
    TASK_CREATED = "task.created",
    TASK_STATUS_CHANGED = "task.status_changed",
    TASK_ASSIGNED = "task.assigned",
    TASK_DUE_APPROACHING = "task.due_approaching",
    COMMENT_ADDED = "comment.added",
    MENTION_CREATED = "mention.created",
    SCHEDULE = "schedule"
}
export declare enum AutomationActionType {
    NOTIFY_USER = "notify_user",
    ASSIGN_USER = "assign_user",
    CHANGE_STATUS = "change_status",
    ADD_COMMENT = "add_comment",
    TAG_TASK = "tag_task",
    WEBHOOK = "webhook",
    AI_PROMPT = "ai_prompt"
}
export declare enum AutomationConditionOperator {
    EQUALS = "eq",
    NOT_EQUALS = "neq",
    IN = "in",
    NOT_IN = "nin",
    GREATER_THAN = "gt",
    LESS_THAN = "lt",
    CONTAINS = "contains",
    EXISTS = "exists"
}
