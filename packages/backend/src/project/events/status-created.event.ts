import { DomainEvent } from '../../events/domain-event.base';

export interface StatusCreatedPayload {
  statusId: string;
  projectId: string | null;
  name: string;
  category: string;
}

export class StatusCreatedEvent extends DomainEvent<StatusCreatedPayload> {
  static readonly aggregateType = 'Status';

  get name(): string {
    return 'status.created';
  }
}
