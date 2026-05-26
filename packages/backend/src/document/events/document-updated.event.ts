import { DomainEvent } from '../../events/domain-event.base';

export interface DocumentUpdatedPayload {
  documentId: string;
  projectId: string | null;
  changes: Record<string, unknown>;
  lastEditedByUserId: string;
}

export class DocumentUpdatedEvent extends DomainEvent<DocumentUpdatedPayload> {
  static readonly aggregateType = 'Document';

  get name(): string {
    return 'document.updated';
  }
}
