import { DomainEvent } from '../../events/domain-event.base';

export interface TaskCreatedPayload {
  taskId: string;
  projectId: string;
  title: string;
  assigneeUserIds?: string[];
}

export class TaskCreatedEvent extends DomainEvent<TaskCreatedPayload> {
  static readonly aggregateType = 'Task';

  get name(): string {
    return 'task.created';
  }
}
