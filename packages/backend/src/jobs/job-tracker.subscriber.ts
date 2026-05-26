import { Injectable } from '@nestjs/common';
import {
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq';
import { JobLogService, RecordEventArgs } from './job-log.service';
import { QUEUES } from './queues.constants';

/**
 * Abstract base for all per-queue BullMQ event subscribers.
 * Subclasses must declare @QueueEventsListener(QUEUES.X) so BullMQ wires
 * the correct queue name at decoration time.
 *
 * Each subclass simply sets `queueName` and inherits the 4 event handlers.
 */
export abstract class BaseJobTrackerSubscriber extends QueueEventsHost {
  abstract readonly queueName: string;

  constructor(protected readonly jobLogService: JobLogService) {
    super();
  }

  @OnQueueEvent('waiting')
  async onWaiting(args: RecordEventArgs): Promise<void> {
    await this.jobLogService.recordEvent(this.queueName, 'waiting', args);
  }

  @OnQueueEvent('active')
  async onActive(args: RecordEventArgs): Promise<void> {
    await this.jobLogService.recordEvent(this.queueName, 'active', args);
  }

  @OnQueueEvent('completed')
  async onCompleted(args: RecordEventArgs): Promise<void> {
    await this.jobLogService.recordEvent(this.queueName, 'completed', args);
  }

  @OnQueueEvent('failed')
  async onFailed(args: RecordEventArgs): Promise<void> {
    await this.jobLogService.recordEvent(this.queueName, 'failed', args);
  }
}

// ── Per-queue thin subclasses ────────────────────────────────────────────────
// BullMQ requires the queue name to be known at decoration time (static).
// Each subclass simply binds to its queue via @QueueEventsListener.

// Each subclass MUST declare its own constructor so Nest can read
// `design:paramtypes` metadata and inject `JobLogService` — inherited
// constructors don't carry decorator metadata.

@Injectable()
@QueueEventsListener(QUEUES.DEFAULT)
export class DefaultQueueSubscriber extends BaseJobTrackerSubscriber {
  readonly queueName = QUEUES.DEFAULT;
  constructor(jobLogService: JobLogService) {
    super(jobLogService);
  }
}

@Injectable()
@QueueEventsListener(QUEUES.EMAIL)
export class EmailQueueSubscriber extends BaseJobTrackerSubscriber {
  readonly queueName = QUEUES.EMAIL;
  constructor(jobLogService: JobLogService) {
    super(jobLogService);
  }
}

@Injectable()
@QueueEventsListener(QUEUES.CLEANUP)
export class CleanupQueueSubscriber extends BaseJobTrackerSubscriber {
  readonly queueName = QUEUES.CLEANUP;
  constructor(jobLogService: JobLogService) {
    super(jobLogService);
  }
}

@Injectable()
@QueueEventsListener(QUEUES.SEARCH_INDEXER)
export class SearchIndexerQueueSubscriber extends BaseJobTrackerSubscriber {
  readonly queueName = QUEUES.SEARCH_INDEXER;
  constructor(jobLogService: JobLogService) {
    super(jobLogService);
  }
}

@Injectable()
@QueueEventsListener(QUEUES.ANALYTICS)
export class AnalyticsQueueSubscriber extends BaseJobTrackerSubscriber {
  readonly queueName = QUEUES.ANALYTICS;
  constructor(jobLogService: JobLogService) {
    super(jobLogService);
  }
}

@Injectable()
@QueueEventsListener(QUEUES.AI)
export class AiQueueSubscriber extends BaseJobTrackerSubscriber {
  readonly queueName = QUEUES.AI;
  constructor(jobLogService: JobLogService) {
    super(jobLogService);
  }
}
