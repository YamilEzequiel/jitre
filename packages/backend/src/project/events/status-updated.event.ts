import { DomainEvent } from '../../events/domain-event.base';

export interface StatusUpdatedPayload {
  statusId: string;
  projectId: string | null;
  changes: Record<string, unknown>;
}

export class StatusUpdatedEvent extends DomainEvent<StatusUpdatedPayload> {
  static readonly aggregateType = 'Status';

  get name(): string {
    return 'status.updated';
  }
}
