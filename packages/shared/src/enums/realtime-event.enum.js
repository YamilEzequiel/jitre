"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeEvent = void 0;
var RealtimeEvent;
(function (RealtimeEvent) {
    RealtimeEvent["TASK_CREATED"] = "task.created";
    RealtimeEvent["TASK_UPDATED"] = "task.updated";
    RealtimeEvent["TASK_STATUS_CHANGED"] = "task.status_changed";
    RealtimeEvent["TASK_ASSIGNED"] = "task.assigned";
    RealtimeEvent["TASK_UNASSIGNED"] = "task.unassigned";
    RealtimeEvent["TASK_COMPLETED"] = "task.completed";
    RealtimeEvent["TASK_DELETED"] = "task.deleted";
    RealtimeEvent["TASK_REORDERED"] = "task.reordered";
    RealtimeEvent["PROJECT_CREATED"] = "project.created";
    RealtimeEvent["PROJECT_UPDATED"] = "project.updated";
    RealtimeEvent["PROJECT_ARCHIVED"] = "project.archived";
    RealtimeEvent["PROJECT_MEMBER_ADDED"] = "project.member.added";
    RealtimeEvent["PROJECT_MEMBER_REMOVED"] = "project.member.removed";
    RealtimeEvent["COMMENT_CREATED"] = "comment.created";
    RealtimeEvent["COMMENT_UPDATED"] = "comment.updated";
    RealtimeEvent["COMMENT_DELETED"] = "comment.deleted";
    RealtimeEvent["NOTIFICATION_CREATED"] = "notification.created";
})(RealtimeEvent || (exports.RealtimeEvent = RealtimeEvent = {}));
//# sourceMappingURL=realtime-event.enum.js.map