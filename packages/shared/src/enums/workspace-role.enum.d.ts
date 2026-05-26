export declare enum WorkspaceRole {
    OWNER = "owner",
    ADMIN = "admin",
    MEMBER = "member",
    GUEST = "guest"
}
export declare const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number>;
export declare function hasAtLeastRole(actual: WorkspaceRole, required: WorkspaceRole): boolean;
