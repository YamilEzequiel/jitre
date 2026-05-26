import { DomainEvent } from '../../events/domain-event.base';

export interface TaskLabelAddedPayload {
  taskId: string;
  projectId: string;
  labelId: string;
}

export class TaskLabelAddedEvent extends DomainEvent<TaskLabelAddedPayload> {
  static readonly aggregateType = 'Task';

  get name(): string {
    return 'task.label.added';
  }
}
