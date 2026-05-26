import { DomainEvent } from '../../events/domain-event.base';

export interface TaskAssignedPayload {
  taskId: string;
  projectId: string;
  assigneeUserId: string;
  assignedByUserId?: string;
}

export class TaskAssignedEvent extends DomainEvent<TaskAssignedPayload> {
  static readonly aggregateType = 'Task';

  get name(): string {
    return 'task.assigned';
  }
}
