import { DomainEvent } from '../../events/domain-event.base';

export interface CustomFieldUpdatedPayload {
  customFieldId: string;
  changes: Record<string, unknown>;
}

export class CustomFieldUpdatedEvent extends DomainEvent<CustomFieldUpdatedPayload> {
  static readonly aggregateType = 'CustomField';

  get name(): string {
    return 'custom_field.updated';
  }
}
