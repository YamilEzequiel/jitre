"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationChannel = exports.NotificationType = void 0;
var NotificationType;
(function (NotificationType) {
    NotificationType["AI_BUDGET_EXCEEDED_NOTIFY"] = "AI_BUDGET_EXCEEDED_NOTIFY";
    NotificationType["AI_QUOTA_WARNING"] = "AI_QUOTA_WARNING";
    NotificationType["TASK_ASSIGNED"] = "task.assigned";
    NotificationType["TASK_MENTIONED"] = "task.mentioned";
    NotificationType["TASK_COMMENTED"] = "task.commented";
    NotificationType["TASK_STATUS_CHANGED"] = "task.status_changed";
    NotificationType["TASK_DUE_SOON"] = "task.due_soon";
    NotificationType["TASK_COMPLETED"] = "task.completed";
    NotificationType["PROJECT_MEMBER_ADDED"] = "project.member.added";
    NotificationType["COMMENT_MENTIONED"] = "comment.mentioned";
    NotificationType["COMMENT_REPLIED"] = "comment.replied";
    NotificationType["WORKSPACE_INVITED"] = "workspace.invited";
    NotificationType["WORKSPACE_OWNERSHIP_TRANSFERRED"] = "WORKSPACE_OWNERSHIP_TRANSFERRED";
    NotificationType["MENTION"] = "MENTION";
    NotificationType["AI_INSIGHT_READY"] = "ai.insight_ready";
    NotificationType["AUTOMATION_TRIGGERED"] = "automation.triggered";
    NotificationType["SYSTEM"] = "system";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["IN_APP"] = "in_app";
    NotificationChannel["EMAIL"] = "email";
    NotificationChannel["WEBSOCKET"] = "websocket";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
//# sourceMappingURL=notification-type.enum.js.map