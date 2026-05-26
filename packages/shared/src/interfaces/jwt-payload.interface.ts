import type { WorkspaceRole } from '../enums/workspace-role.enum';

export interface IJwtAccessPayload {
  sub: string;
  email: string;
  workspaceId?: string;
  role?: WorkspaceRole;
}

/**
 * Refresh tokens are opaque random hex (not JWT). No claims are carried.
 * This type is a documentation stub only — the actual token is a 256-bit
 * hex string stored hashed at rest.
 */
export interface IJwtRefreshPayload {
  _opaque: true;
}
