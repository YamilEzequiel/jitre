import { WorkspaceRole } from '@jitre/shared';
import { DomainEvent } from '../domain-event.base';

export interface WorkspaceMemberAddedPayload {
  addedUserId: string;
  role: WorkspaceRole;
}

export class WorkspaceMemberAddedEvent extends DomainEvent<WorkspaceMemberAddedPayload> {
  static readonly aggregateType = 'WorkspaceMembership';

  get name(): string {
    return 'workspace.member.added';
  }
}
