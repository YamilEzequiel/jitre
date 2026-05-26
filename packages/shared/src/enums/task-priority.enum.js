"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_PRIORITY_RANK = exports.TaskPriority = void 0;
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["NONE"] = "none";
    TaskPriority["LOW"] = "low";
    TaskPriority["MEDIUM"] = "medium";
    TaskPriority["HIGH"] = "high";
    TaskPriority["URGENT"] = "urgent";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
exports.TASK_PRIORITY_RANK = {
    [TaskPriority.NONE]: 0,
    [TaskPriority.LOW]: 1,
    [TaskPriority.MEDIUM]: 2,
    [TaskPriority.HIGH]: 3,
    [TaskPriority.URGENT]: 4,
};
//# sourceMappingURL=task-priority.enum.js.map