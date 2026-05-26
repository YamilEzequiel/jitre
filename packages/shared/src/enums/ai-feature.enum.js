"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderName = exports.AIFeature = void 0;
var AIFeature;
(function (AIFeature) {
    AIFeature["ROADMAP_FROM_TEXT"] = "roadmap_from_text";
    AIFeature["MEETING_TO_TASKS"] = "meeting_to_tasks";
    AIFeature["BLOCKER_DETECTION"] = "blocker_detection";
    AIFeature["DUPLICATE_DETECTION"] = "duplicate_detection";
    AIFeature["PRIORITY_SUGGESTION"] = "priority_suggestion";
    AIFeature["SUBTASK_GEN"] = "subtask_gen";
    AIFeature["CHECKLIST_GEN"] = "checklist_gen";
    AIFeature["SPRINT_SUMMARY"] = "sprint_summary";
    AIFeature["CHANGELOG_GEN"] = "changelog_gen";
    AIFeature["RELEASE_NOTES_GEN"] = "release_notes_gen";
    AIFeature["CONVERSATION_SUMMARY"] = "conversation_summary";
    AIFeature["DELAY_RISK"] = "delay_risk";
    AIFeature["ASSIGNEE_SUGGESTION"] = "assignee_suggestion";
    AIFeature["OVERLOAD_DETECTION"] = "overload_detection";
    AIFeature["PM_ASSISTANT"] = "pm_assistant";
})(AIFeature || (exports.AIFeature = AIFeature = {}));
var AIProviderName;
(function (AIProviderName) {
    AIProviderName["GEMINI"] = "gemini";
    AIProviderName["ANTHROPIC"] = "anthropic";
    AIProviderName["OPENAI"] = "openai";
})(AIProviderName || (exports.AIProviderName = AIProviderName = {}));
//# sourceMappingURL=ai-feature.enum.js.map