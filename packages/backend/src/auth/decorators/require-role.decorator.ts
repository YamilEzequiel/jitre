import { SetMetadata } from '@nestjs/common';
import type { WorkspaceRole } from '@jitre/shared';

export const REQUIRE_ROLE_KEY = 'requireRole';
export const RequireRole = (role: WorkspaceRole) =>
  SetMetadata(REQUIRE_ROLE_KEY, role);
