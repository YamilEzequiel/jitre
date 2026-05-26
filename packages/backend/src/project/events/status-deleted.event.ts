import { DomainEvent } from '../../events/domain-event.base';

export interface StatusDeletedPayload {
  statusId: string;
  replacedByStatusId?: string;
  projectId: string | null;
}

export class StatusDeletedEvent extends DomainEvent<StatusDeletedPayload> {
  static readonly aggregateType = 'Status';

  get name(): string {
    return 'status.deleted';
  }
}
