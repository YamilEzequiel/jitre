import { DomainEvent } from '../../events/domain-event.base';

export interface LabelDeletedPayload {
  labelId: string;
  projectId: string | null;
}

export class LabelDeletedEvent extends DomainEvent<LabelDeletedPayload> {
  static readonly aggregateType = 'Label';

  get name(): string {
    return 'label.deleted';
  }
}
