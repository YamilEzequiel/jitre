import { DomainEvent } from '../../events/domain-event.base';

export interface CustomFieldCreatedPayload {
  customFieldId: string;
  projectId: string | null;
  name: string;
  type: string;
}

export class CustomFieldCreatedEvent extends DomainEvent<CustomFieldCreatedPayload> {
  static readonly aggregateType = 'CustomField';

  get name(): string {
    return 'custom_field.created';
  }
}
