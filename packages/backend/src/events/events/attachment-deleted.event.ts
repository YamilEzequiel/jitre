import { DomainEvent } from '../domain-event.base';

export interface AttachmentDeletedPayload {
  attachmentId: string;
  actorUserId: string;
  storageKey: string;
}

export class AttachmentDeletedEvent extends DomainEvent<AttachmentDeletedPayload> {
  static readonly aggregateType = 'Attachment';

  get name(): string {
    return 'attachment.deleted';
  }
}
