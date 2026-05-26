import { DomainEvent } from '../../events/domain-event.base';

export interface LabelUpdatedPayload {
  labelId: string;
  changes: Record<string, unknown>;
  nameChanged?: boolean;
}

export class LabelUpdatedEvent extends DomainEvent<LabelUpdatedPayload> {
  static readonly aggregateType = 'Label';

  get name(): string {
    return 'label.updated';
  }
}
