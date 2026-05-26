"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_ROLE_RANK = exports.WorkspaceRole = void 0;
exports.hasAtLeastRole = hasAtLeastRole;
var WorkspaceRole;
(function (WorkspaceRole) {
    WorkspaceRole["OWNER"] = "owner";
    WorkspaceRole["ADMIN"] = "admin";
    WorkspaceRole["MEMBER"] = "member";
    WorkspaceRole["GUEST"] = "guest";
})(WorkspaceRole || (exports.WorkspaceRole = WorkspaceRole = {}));
exports.WORKSPACE_ROLE_RANK = {
    [WorkspaceRole.OWNER]: 40,
    [WorkspaceRole.ADMIN]: 30,
    [WorkspaceRole.MEMBER]: 20,
    [WorkspaceRole.GUEST]: 10,
};
function hasAtLeastRole(actual, required) {
    return exports.WORKSPACE_ROLE_RANK[actual] >= exports.WORKSPACE_ROLE_RANK[required];
}
//# sourceMappingURL=workspace-role.enum.js.map