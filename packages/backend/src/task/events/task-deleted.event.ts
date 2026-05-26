import { DomainEvent } from '../../events/domain-event.base';

export interface TaskDeletedPayload {
  taskId: string;
  projectId: string;
}

export class TaskDeletedEvent extends DomainEvent<TaskDeletedPayload> {
  static readonly aggregateType = 'Task';

  get name(): string {
    return 'task.deleted';
  }
}
