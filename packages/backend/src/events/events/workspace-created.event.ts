import { DomainEvent } from '../domain-event.base';

export interface WorkspaceCreatedPayload {
  name: string;
  slug: string;
}

export class WorkspaceCreatedEvent extends DomainEvent<WorkspaceCreatedPayload> {
  static readonly aggregateType = 'Workspace';

  get name(): string {
    return 'workspace.created';
  }
}
