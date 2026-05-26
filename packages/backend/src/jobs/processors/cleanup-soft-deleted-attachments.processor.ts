import { Inject, Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Job } from 'bullmq';
import { QUEUES } from '../queues.constants';
import { Attachment } from '../../attachment/attachment.entity';
import { STORAGE_DRIVER, type IStorageDriver } from '../../storage';

interface AttachmentRow {
  id: string;
  storageKey: string;
  deletedAt: Date;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
@Processor(QUEUES.CLEANUP)
export class CleanupSoftDeletedAttachmentsProcessor extends WorkerHost {
  private readonly logger = new Logger(
    CleanupSoftDeletedAttachmentsProcessor.name,
  );

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @Inject(STORAGE_DRIVER)
    private readonly storageDriver: IStorageDriver,
  ) {
    super();
  }

  async process(_job: Job): Promise<{
    deletedCount: number;
    missingFileCount: number;
    errorCount: number;
  }> {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

    const rows = await this.attachmentRepo.find({
      where: {
        deletedAt: LessThan(cutoff),
      } as never,
      take: 500,
      withDeleted: true,
    });

    let deletedCount = 0;
    let missingFileCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      try {
        await this.storageDriver.delete(row.storageKey);
      } catch (err) {
        const isNotFound =
          (err as Record<string, unknown>).code === 'NOT_FOUND' ||
          (err as Error).message?.includes('NotFound') ||
          (err as Error).message?.includes('not found');
        if (isNotFound) {
          this.logger.warn(
            `Storage key not found: ${row.storageKey} — proceeding with hard-delete`,
          );
          missingFileCount++;
        } else {
          this.logger.error(
            `Failed to delete storage key ${row.storageKey}: ${(err as Error).message}`,
          );
          errorCount++;
          continue;
        }
      }

      await this.attachmentRepo.delete(row.id);
      deletedCount++;
      this.logger.log(`Hard-deleted attachment row ${row.id}`);
    }

    return { deletedCount, missingFileCount, errorCount };
  }
}
