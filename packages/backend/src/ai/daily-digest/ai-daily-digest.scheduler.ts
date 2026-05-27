import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiDailyDigestService } from './ai-daily-digest.service';

/**
 * Generates yesterday's narrative digest for every workspace, once a day.
 * Runs at 06:00 UTC by default; admins can re-trigger per workspace from
 * the API. Failures are logged but never crash the scheduler.
 */
@Injectable()
export class AiDailyDigestScheduler {
  private readonly logger = new Logger(AiDailyDigestScheduler.name);

  constructor(private readonly service: AiDailyDigestService) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { name: 'ai-daily-digest', timeZone: 'UTC' })
  async run(): Promise<void> {
    this.logger.log('Generating daily digests for all workspaces…');
    const result = await this.service.generateAll();
    this.logger.log(
      `Daily digest pass complete: ${result.generated} generated, ${result.failed} failed.`,
    );
  }
}
