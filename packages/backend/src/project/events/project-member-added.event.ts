import { DomainEvent } from '../../events/domain-event.base';

export interface ProjectMemberAddedPayload {
  projectId: string;
  userId: string;
  role: string;
}

export class ProjectMemberAddedEvent extends DomainEvent<ProjectMemberAddedPayload> {
  static readonly aggregateType = 'Project';

  get name(): string {
    return 'project.member.added';
  }
}
