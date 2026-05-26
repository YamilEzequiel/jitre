import { DomainEvent } from '../../events/domain-event.base';

export interface TaskLabelRemovedPayload {
  taskId: string;
  projectId: string;
  labelId: string;
}

export class TaskLabelRemovedEvent extends DomainEvent<TaskLabelRemovedPayload> {
  static readonly aggregateType = 'Task';

  get name(): string {
    return 'task.label.removed';
  }
}
