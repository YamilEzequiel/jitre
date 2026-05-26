import { DomainEvent } from '../../events/domain-event.base';

export interface TaskStatusChangedPayload {
  taskId: string;
  projectId: string;
  previousStatusId: string;
  newStatusId: string;
  newCategory: string;
  assigneeUserIds?: string[];
}

export class TaskStatusChangedEvent extends DomainEvent<TaskStatusChangedPayload> {
  static readonly aggregateType = 'Task';

  get name(): string {
    return 'task.status_changed';
  }
}
