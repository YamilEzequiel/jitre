import { DomainEvent } from '../../events/domain-event.base';

export interface DocumentDeletedPayload {
  documentId: string;
  projectId: string | null;
  actorUserId: string;
  cascadedChildIds: string[];
}

export class DocumentDeletedEvent extends DomainEvent<DocumentDeletedPayload> {
  static readonly aggregateType = 'Document';

  get name(): string {
    return 'document.deleted';
  }
}
