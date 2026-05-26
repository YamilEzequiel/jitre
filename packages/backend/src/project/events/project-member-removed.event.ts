import { DomainEvent } from '../../events/domain-event.base';

export interface ProjectMemberRemovedPayload {
  projectId: string;
  userId: string;
  previousRole: string;
}

export class ProjectMemberRemovedEvent extends DomainEvent<ProjectMemberRemovedPayload> {
  static readonly aggregateType = 'Project';

  get name(): string {
    return 'project.member.removed';
  }
}
