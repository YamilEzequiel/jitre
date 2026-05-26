import type { WorkspaceRole } from '../enums/workspace-role.enum';
export interface ISessionContext {
    userId: string;
    workspaceId: string | null;
    role: WorkspaceRole | null;
    requestId: string;
}
export interface IAuthenticatedUser {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
}
