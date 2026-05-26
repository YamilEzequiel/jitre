import type { WorkspaceRole } from '../enums/workspace-role.enum';
export interface IJwtAccessPayload {
    sub: string;
    email: string;
    workspaceId?: string;
    role?: WorkspaceRole;
}
export interface IJwtRefreshPayload {
    _opaque: true;
}
