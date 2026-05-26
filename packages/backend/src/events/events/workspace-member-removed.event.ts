import { WorkspaceRole } from '@jitre/shared';
import { DomainEvent } from '../domain-event.base';

export interface WorkspaceMemberRemovedPayload {
  removedUserId: string;
  previousRole: WorkspaceRole;
}

export class WorkspaceMemberRemovedEvent extends DomainEvent<WorkspaceMemberRemovedPayload> {
  static readonly aggregateType = 'WorkspaceMembership';

  get name(): string {
    return 'workspace.member.removed';
  }
}
