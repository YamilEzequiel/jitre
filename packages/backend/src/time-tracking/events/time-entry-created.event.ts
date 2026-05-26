import { DomainEvent } from '../../events/domain-event.base';

export interface TimeEntryCreatedPayload {
  timeEntryId: string;
  taskId: string;
  userId: string;
  durationMinutes: number;
  date: string;
  billable: boolean;
  /** True when this entry was opened via the timer flow (durationMinutes=0). */
  timerStarted: boolean;
}

export class TimeEntryCreatedEvent extends DomainEvent<TimeEntryCreatedPayload> {
  static readonly aggregateType = 'TimeEntry';

  get name(): string {
    return 'timeEntry.created';
  }
}
