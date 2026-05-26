import { DomainEvent } from '../../events/domain-event.base';

export interface ProjectCreatedPayload {
  projectId: string;
  name: string;
  key: string;
  ownerUserId: string;
}

export class ProjectCreatedEvent extends DomainEvent<ProjectCreatedPayload> {
  static readonly aggregateType = 'Project';

  get name(): string {
    return 'project.created';
  }
}
