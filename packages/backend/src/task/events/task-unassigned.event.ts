import { DomainEvent } from '../../events/domain-event.base';

export interface TaskUnassignedPayload {
  taskId: string;
  projectId: string;
  assigneeUserId: string;
}

export class TaskUnassignedEvent extends DomainEvent<TaskUnassignedPayload> {
  static readonly aggregateType = 'Task';

  get name(): string {
    return 'task.unassigned';
  }
}
