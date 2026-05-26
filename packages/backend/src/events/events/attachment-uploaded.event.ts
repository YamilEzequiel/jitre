import { DomainEvent } from '../domain-event.base';

export interface AttachmentUploadedPayload {
  attachmentId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  uploaderUserId: string;
  context: string;
  contextId?: string;
}

export class AttachmentUploadedEvent extends DomainEvent<AttachmentUploadedPayload> {
  static readonly aggregateType = 'Attachment';

  get name(): string {
    return 'attachment.uploaded';
  }
}
