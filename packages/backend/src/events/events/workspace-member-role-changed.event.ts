import { WorkspaceRole } from '@jitre/shared';
import { DomainEvent } from '../domain-event.base';

export interface WorkspaceMemberRoleChangedPayload {
  targetUserId: string;
  previousRole: WorkspaceRole;
  newRole: WorkspaceRole;
}

export class WorkspaceMemberRoleChangedEvent extends DomainEvent<WorkspaceMemberRoleChangedPayload> {
  static readonly aggregateType = 'WorkspaceMembership';

  get name(): string {
    return 'workspace.member.role.changed';
  }
}
