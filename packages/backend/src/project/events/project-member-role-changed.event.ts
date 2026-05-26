import { DomainEvent } from '../../events/domain-event.base';

export interface ProjectMemberRoleChangedPayload {
  projectId: string;
  userId: string;
  newRole: string;
  previousRole: string;
}

export class ProjectMemberRoleChangedEvent extends DomainEvent<ProjectMemberRoleChangedPayload> {
  static readonly aggregateType = 'Project';

  get name(): string {
    return 'project.member.role_changed';
  }
}
