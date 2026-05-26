import { DomainEvent } from '../../events/domain-event.base';

export interface TaskUpdatedPayload {
  taskId: string;
  projectId: string;
  changes: Record<string, unknown>;
}

export class TaskUpdatedEvent extends DomainEvent<TaskUpdatedPayload> {
  static readonly aggregateType = 'Task';

  get name(): string {
    return 'task.updated';
  }
}
