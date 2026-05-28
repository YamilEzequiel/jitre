import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '../../jobs/queues.constants';
import { MetricsService } from './metrics.service';

const SAMPLED_STATES: Array<
  'waiting' | 'active' | 'delayed' | 'failed' | 'completed'
> = ['waiting', 'active', 'delayed', 'failed', 'completed'];

@Injectable()
export class QueueMetricsCollector {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: Logger,
    @InjectQueue(QUEUES.DEFAULT) private readonly defaultQueue: Queue,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUES.CLEANUP) private readonly cleanupQueue: Queue,
    @InjectQueue(QUEUES.SEARCH_INDEXER) private readonly indexerQueue: Queue,
    @InjectQueue(QUEUES.ANALYTICS) private readonly analyticsQueue: Queue,
    @InjectQueue(QUEUES.AI) private readonly aiQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sample(): Promise<void> {
    const queues: Array<[string, Queue]> = [
      [QUEUES.DEFAULT, this.defaultQueue],
      [QUEUES.EMAIL, this.emailQueue],
      [QUEUES.CLEANUP, this.cleanupQueue],
      [QUEUES.SEARCH_INDEXER, this.indexerQueue],
      [QUEUES.ANALYTICS, this.analyticsQueue],
      [QUEUES.AI, this.aiQueue],
    ];

    await Promise.all(
      queues.map(async ([name, queue]) => {
        try {
          const counts = await queue.getJobCounts(...SAMPLED_STATES);
          for (const state of SAMPLED_STATES) {
            const value = counts[state] ?? 0;
            this.metrics.bullmqQueueDepth.set({ queue: name, state }, value);
          }
        } catch (err: unknown) {
          this.logger.warn({
            event: 'queue.metrics.sample_failed',
            queue: name,
            err: String(err),
          });
        }
      }),
    );
  }
}
