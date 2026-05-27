import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiAutoPrioritizeService } from './ai-auto-prioritize.service';

@Injectable()
export class AiAutoPrioritizeScheduler {
  private readonly logger = new Logger(AiAutoPrioritizeScheduler.name);

  constructor(private readonly service: AiAutoPrioritizeService) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM, { name: 'ai-auto-prioritize', timeZone: 'UTC' })
  async run(): Promise<void> {
    this.logger.log('Generating auto-prioritize suggestions for all workspaces…');
    const res = await this.service.generateAll();
    this.logger.log(
      `Auto-prioritize pass complete: ${res.created} new suggestions, ${res.stale} marked stale.`,
    );
  }
}
