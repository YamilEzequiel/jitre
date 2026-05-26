import type { AttachmentContext } from '../enums/attachment-context.enum';
import type { StorageDriver } from '../enums/storage-driver.enum';
export interface IAttachment {
    id: string;
    workspaceId: string;
    context: AttachmentContext;
    contextId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    storageDriver: StorageDriver;
    storageKey: string;
    uploadedBy: string;
    createdAt: string;
}
