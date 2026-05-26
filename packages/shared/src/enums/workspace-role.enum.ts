export enum WorkspaceRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  GUEST = 'guest',
}

export const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  [WorkspaceRole.OWNER]: 40,
  [WorkspaceRole.ADMIN]: 30,
  [WorkspaceRole.MEMBER]: 20,
  [WorkspaceRole.GUEST]: 10,
};

export function hasAtLeastRole(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return WORKSPACE_ROLE_RANK[actual] >= WORKSPACE_ROLE_RANK[required];
}
