import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOB_NAMES } from '../queues.constants';

/**
 * Fires daily at 03:00 UTC to enqueue the soft-deleted attachment cleanup job.
 * The actual work is done by CleanupSoftDeletedAttachmentsProcessor (retry / idempotent).
 */
@Injectable()
export class CleanupScheduler {
  private readonly logger = new Logger(CleanupScheduler.name);

  constructor(
    @InjectQueue(QUEUES.CLEANUP) private readonly cleanupQueue: Queue,
  ) {}

  @Cron('0 3 * * *', { timeZone: 'UTC', name: 'attachments-cleanup' })
  async scheduleCleanup(): Promise<void> {
    this.logger.log('Enqueuing attachments-cleanup job');
    await this.cleanupQueue.add(
      JOB_NAMES.ATTACHMENTS_CLEANUP_SOFT_DELETED,
      {},
      {
        jobId: `cleanup-${new Date().toISOString().slice(0, 10)}`,
      },
    );
  }
}
