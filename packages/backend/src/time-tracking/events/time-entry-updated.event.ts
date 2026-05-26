import { DomainEvent } from '../../events/domain-event.base';

export interface TimeEntryUpdatedPayload {
  timeEntryId: string;
  taskId: string;
  userId: string;
  changes: Record<string, unknown>;
  /** True if this update closed an active timer. */
  timerStopped: boolean;
}

export class TimeEntryUpdatedEvent extends DomainEvent<TimeEntryUpdatedPayload> {
  static readonly aggregateType = 'TimeEntry';

  get name(): string {
    return 'timeEntry.updated';
  }
}
