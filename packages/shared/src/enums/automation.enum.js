"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationConditionOperator = exports.AutomationActionType = exports.AutomationTriggerType = void 0;
var AutomationTriggerType;
(function (AutomationTriggerType) {
    AutomationTriggerType["TASK_CREATED"] = "task.created";
    AutomationTriggerType["TASK_STATUS_CHANGED"] = "task.status_changed";
    AutomationTriggerType["TASK_ASSIGNED"] = "task.assigned";
    AutomationTriggerType["TASK_DUE_APPROACHING"] = "task.due_approaching";
    AutomationTriggerType["COMMENT_ADDED"] = "comment.added";
    AutomationTriggerType["MENTION_CREATED"] = "mention.created";
    AutomationTriggerType["SCHEDULE"] = "schedule";
})(AutomationTriggerType || (exports.AutomationTriggerType = AutomationTriggerType = {}));
var AutomationActionType;
(function (AutomationActionType) {
    AutomationActionType["NOTIFY_USER"] = "notify_user";
    AutomationActionType["ASSIGN_USER"] = "assign_user";
    AutomationActionType["CHANGE_STATUS"] = "change_status";
    AutomationActionType["ADD_COMMENT"] = "add_comment";
    AutomationActionType["TAG_TASK"] = "tag_task";
    AutomationActionType["WEBHOOK"] = "webhook";
    AutomationActionType["AI_PROMPT"] = "ai_prompt";
})(AutomationActionType || (exports.AutomationActionType = AutomationActionType = {}));
var AutomationConditionOperator;
(function (AutomationConditionOperator) {
    AutomationConditionOperator["EQUALS"] = "eq";
    AutomationConditionOperator["NOT_EQUALS"] = "neq";
    AutomationConditionOperator["IN"] = "in";
    AutomationConditionOperator["NOT_IN"] = "nin";
    AutomationConditionOperator["GREATER_THAN"] = "gt";
    AutomationConditionOperator["LESS_THAN"] = "lt";
    AutomationConditionOperator["CONTAINS"] = "contains";
    AutomationConditionOperator["EXISTS"] = "exists";
})(AutomationConditionOperator || (exports.AutomationConditionOperator = AutomationConditionOperator = {}));
//# sourceMappingURL=automation.enum.js.map