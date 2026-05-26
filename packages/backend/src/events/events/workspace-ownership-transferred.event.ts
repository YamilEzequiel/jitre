import { DomainEvent } from '../domain-event.base';

export interface WorkspaceOwnershipTransferredPayload {
  previousOwnerId: string;
  newOwnerId: string;
}

export class WorkspaceOwnershipTransferredEvent extends DomainEvent<WorkspaceOwnershipTransferredPayload> {
  static readonly aggregateType = 'Workspace';

  get name(): string {
    return 'workspace.ownership.transferred';
  }
}
