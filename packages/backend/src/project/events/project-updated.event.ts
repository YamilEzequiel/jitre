import { DomainEvent } from '../../events/domain-event.base';

export interface ProjectUpdatedPayload {
  projectId: string;
  changes: Record<string, unknown>;
}

export class ProjectUpdatedEvent extends DomainEvent<ProjectUpdatedPayload> {
  static readonly aggregateType = 'Project';

  get name(): string {
    return 'project.updated';
  }
}
