"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TERMINAL_TASK_STATUSES = exports.TaskStatus = void 0;
exports.isTerminalStatus = isTerminalStatus;
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["BACKLOG"] = "backlog";
    TaskStatus["TODO"] = "todo";
    TaskStatus["IN_PROGRESS"] = "in_progress";
    TaskStatus["IN_REVIEW"] = "in_review";
    TaskStatus["BLOCKED"] = "blocked";
    TaskStatus["DONE"] = "done";
    TaskStatus["CANCELED"] = "canceled";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
exports.TERMINAL_TASK_STATUSES = new Set([
    TaskStatus.DONE,
    TaskStatus.CANCELED,
]);
function isTerminalStatus(status) {
    return exports.TERMINAL_TASK_STATUSES.has(status);
}
//# sourceMappingURL=task-status.enum.js.map