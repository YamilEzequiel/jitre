import { DomainEvent } from '../../events/domain-event.base';

export interface ProjectDeletedPayload {
  projectId: string;
}

export class ProjectDeletedEvent extends DomainEvent<ProjectDeletedPayload> {
  static readonly aggregateType = 'Project';

  get name(): string {
    return 'project.deleted';
  }
}
