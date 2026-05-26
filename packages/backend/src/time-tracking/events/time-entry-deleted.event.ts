import { DomainEvent } from '../../events/domain-event.base';

export interface TimeEntryDeletedPayload {
  timeEntryId: string;
  taskId: string;
  userId: string;
  actorUserId: string;
}

export class TimeEntryDeletedEvent extends DomainEvent<TimeEntryDeletedPayload> {
  static readonly aggregateType = 'TimeEntry';

  get name(): string {
    return 'timeEntry.deleted';
  }
}
