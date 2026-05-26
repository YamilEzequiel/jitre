import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { JobLogService } from '../job-log.service';

/**
 * Fires weekly on Sunday at 04:00 UTC. Deletes JobLog rows older than
 * JOB_LOG_RETENTION_DAYS (default 90).
 */
@Injectable()
export class JobLogPruneScheduler {
  private readonly logger = new Logger(JobLogPruneScheduler.name);

  constructor(
    private readonly jobLogService: JobLogService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 4 * * 0', { timeZone: 'UTC', name: 'job-log-prune' })
  async pruneJobLog(): Promise<void> {
    const retentionDays =
      this.configService.get<number>('JOB_LOG_RETENTION_DAYS') ?? 90;
    this.logger.log(`Pruning job logs older than ${retentionDays} days`);
    await this.jobLogService.pruneOlderThan(retentionDays);
  }
}
