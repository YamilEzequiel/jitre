import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  AttachmentContext,
  WorkspaceRole,
  hasAtLeastRole,
} from '@jitre/shared';
import { Attachment } from './attachment.entity';
import { STORAGE_DRIVER } from '../storage/storage.constants';
import { IStorageDriver } from '../storage/drivers/storage-driver.interface';
import { buildStorageKey } from '../storage/path-builder.util';
import {
  validateAvatarMime,
  validateAttachmentMime,
} from './mime-validator.util';
import { EventBusService } from '../events/event-bus.service';
import { AttachmentUploadedEvent } from '../events/events/attachment-uploaded.event';
import { AttachmentDeletedEvent } from '../events/events/attachment-deleted.event';

const AVATAR_CONTEXTS = [
  AttachmentContext.USER_AVATAR,
  AttachmentContext.WORKSPACE_AVATAR,
];

export interface UploadInput {
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  context: AttachmentContext;
  contextId?: string;
  uploaderUserId: string;
  workspaceId: string;
}

export interface DownloadResult {
  driver: 'local' | 's3' | 'r2';
  attachment: Attachment;
  signedUrl: string;
}

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  private readonly maxFileSizeBytes: number;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @Inject(STORAGE_DRIVER)
    private readonly driver: IStorageDriver,
    private readonly eventBus: EventBusService,
    private readonly configService: ConfigService,
  ) {
    this.maxFileSizeBytes = configService.get<number>(
      'storage.maxFileSizeBytes',
      25 * 1024 * 1024,
    );
  }

  async upload(input: UploadInput): Promise<Attachment> {
    const { file, context, contextId, uploaderUserId, workspaceId } = input;

    if (file.size > this.maxFileSizeBytes) {
      throw new PayloadTooLargeException('FILE_TOO_LARGE');
    }

    const isAvatar = AVATAR_CONTEXTS.includes(context);
    const validation = isAvatar
      ? await validateAvatarMime(file.buffer, file.mimetype)
      : await validateAttachmentMime(file.buffer, file.mimetype);

    if (!validation.valid) {
      throw new BadRequestException(validation.reason ?? 'INVALID_MIME_TYPE');
    }

    const attachmentId = randomUUID();
    const storageKey = buildStorageKey({
      workspaceId,
      context,
      contextId,
      attachmentId,
      originalFilename: file.originalname,
    });

    const putResult = await this.driver.put({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
      sizeBytes: file.size,
    });

    const entity = this.attachmentRepo.create({
      id: attachmentId,
      workspaceId,
      context,
      contextId: contextId ?? null,
      uploadedByUserId: uploaderUserId,
      storageKey,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: putResult.sizeBytes,
      checksum: putResult.checksum ?? null,
    });

    try {
      const saved = await this.attachmentRepo.save(entity);
      this.eventBus.publish(
        new AttachmentUploadedEvent({
          aggregateId: saved.id,
          aggregateType: 'Attachment',
          workspaceId,
          actorUserId: uploaderUserId,
          payload: {
            attachmentId: saved.id,
            storageKey,
            mimeType: file.mimetype,
            sizeBytes: putResult.sizeBytes,
            uploaderUserId,
            context,
            contextId,
          },
        }),
      );
      return saved;
    } catch (err) {
      try {
        await this.driver.delete(storageKey);
      } catch (cleanupErr) {
        this.logger.error(
          { storageKey, cleanupErr },
          'Failed to clean up storage after DB error',
        );
      }
      throw err;
    }
  }

  async findByIdScoped(id: string, workspaceId: string): Promise<Attachment> {
    const att = await this.attachmentRepo.findOne({
      where: { id, workspaceId },
    });
    if (!att) {
      throw new NotFoundException('ATTACHMENT_NOT_FOUND');
    }
    return att;
  }

  async download(id: string, workspaceId: string): Promise<DownloadResult> {
    const att = await this.findByIdScoped(id, workspaceId);
    const signedUrl = await this.driver.getSignedUrl(att.storageKey, {
      ttlSeconds: 300,
    });
    return {
      driver: this.driver.name,
      attachment: att,
      signedUrl,
    };
  }

  async softDelete(
    id: string,
    actorUserId: string,
    actorRole: WorkspaceRole,
    workspaceId: string,
  ): Promise<void> {
    const att = await this.findByIdScoped(id, workspaceId);

    const isOwner = att.uploadedByUserId === actorUserId;
    const isAdmin = hasAtLeastRole(actorRole, WorkspaceRole.ADMIN);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('INSUFFICIENT_PERMISSION');
    }

    await this.attachmentRepo.softDelete(id);

    this.eventBus.publish(
      new AttachmentDeletedEvent({
        aggregateId: id,
        aggregateType: 'Attachment',
        workspaceId,
        actorUserId,
        payload: { attachmentId: id, actorUserId, storageKey: att.storageKey },
      }),
    );
  }

  async replaceAvatar(input: UploadInput): Promise<Attachment> {
    const { context, contextId, workspaceId } = input;

    const existing = await this.attachmentRepo.findOne({
      where: { workspaceId, context, contextId: contextId ?? IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (existing) {
      await this.attachmentRepo.softDelete(existing.id);
      this.eventBus.publish(
        new AttachmentDeletedEvent({
          aggregateId: existing.id,
          aggregateType: 'Attachment',
          workspaceId,
          actorUserId: input.uploaderUserId,
          payload: {
            attachmentId: existing.id,
            actorUserId: input.uploaderUserId,
            storageKey: existing.storageKey,
          },
        }),
      );
    }

    return this.upload(input);
  }
}
