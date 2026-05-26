import { DomainEvent } from '../../events/domain-event.base';

export interface TaskDueSoonPayload {
  taskId: string;
  projectId: string;
  dueDate: string;
  assigneeUserIds: string[];
}

export class TaskDueSoonEvent extends DomainEvent<TaskDueSoonPayload> {
  static readonly aggregateType = 'Task';

  get name(): string {
    return 'task.due_soon';
  }
}
