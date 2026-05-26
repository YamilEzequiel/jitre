import { DomainEvent } from '../../events/domain-event.base';

export interface ProjectArchivedPayload {
  projectId: string;
}

export class ProjectArchivedEvent extends DomainEvent<ProjectArchivedPayload> {
  static readonly aggregateType = 'Project';

  get name(): string {
    return 'project.archived';
  }
}
