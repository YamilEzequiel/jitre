import { DomainEvent } from '../../events/domain-event.base';

export interface TaskCompletedPayload {
  taskId: string;
  projectId: string;
  completedAt: string;
  assigneeUserIds?: string[];
}

export class TaskCompletedEvent extends DomainEvent<TaskCompletedPayload> {
  static readonly aggregateType = 'Task';

  get name(): string {
    return 'task.completed';
  }
}
