import { DomainEvent } from '../../events/domain-event.base';

export interface LabelCreatedPayload {
  labelId: string;
  projectId: string | null;
  name: string;
  scope: string;
}

export class LabelCreatedEvent extends DomainEvent<LabelCreatedPayload> {
  static readonly aggregateType = 'Label';

  get name(): string {
    return 'label.created';
  }
}
