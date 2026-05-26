import { DomainEvent } from '../../events/domain-event.base';

export interface DocumentCreatedPayload {
  documentId: string;
  projectId: string | null;
  parentId: string | null;
  title: string;
  creatorUserId: string;
}

export class DocumentCreatedEvent extends DomainEvent<DocumentCreatedPayload> {
  static readonly aggregateType = 'Document';

  get name(): string {
    return 'document.created';
  }
}
