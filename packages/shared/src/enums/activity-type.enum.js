"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityType = void 0;
var ActivityType;
(function (ActivityType) {
    ActivityType["TASK_CREATED"] = "task.created";
    ActivityType["TASK_UPDATED"] = "task.updated";
    ActivityType["TASK_STATUS_CHANGED"] = "task.status_changed";
    ActivityType["TASK_ASSIGNED"] = "task.assigned";
    ActivityType["TASK_UNASSIGNED"] = "task.unassigned";
    ActivityType["TASK_PRIORITY_CHANGED"] = "task.priority_changed";
    ActivityType["TASK_DUE_DATE_CHANGED"] = "task.due_date_changed";
    ActivityType["TASK_DELETED"] = "task.deleted";
    ActivityType["COMMENT_ADDED"] = "comment.added";
    ActivityType["COMMENT_EDITED"] = "comment.edited";
    ActivityType["COMMENT_DELETED"] = "comment.deleted";
    ActivityType["ATTACHMENT_ADDED"] = "attachment.added";
    ActivityType["ATTACHMENT_REMOVED"] = "attachment.removed";
    ActivityType["PROJECT_CREATED"] = "project.created";
    ActivityType["PROJECT_UPDATED"] = "project.updated";
    ActivityType["SPRINT_STARTED"] = "sprint.started";
    ActivityType["SPRINT_COMPLETED"] = "sprint.completed";
    ActivityType["MEMBER_ADDED"] = "member.added";
    ActivityType["MEMBER_REMOVED"] = "member.removed";
    ActivityType["AI_GENERATED"] = "ai.generated";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
//# sourceMappingURL=activity-type.enum.js.map