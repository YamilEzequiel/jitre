import { DomainEvent } from '../../events/domain-event.base';

export interface CustomFieldDeletedPayload {
  customFieldId: string;
}

export class CustomFieldDeletedEvent extends DomainEvent<CustomFieldDeletedPayload> {
  static readonly aggregateType = 'CustomField';

  get name(): string {
    return 'custom_field.deleted';
  }
}
