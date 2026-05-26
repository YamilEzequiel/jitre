import {
  Global,
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { QUEUES, BULL_BOARD_ADAPTER } from './queues.constants';
import { JobLog } from './job-log.entity';
import { JobLogService } from './job-log.service';
import {
  DefaultQueueSubscriber,
  EmailQueueSubscriber,
  CleanupQueueSubscriber,
  SearchIndexerQueueSubscriber,
  AnalyticsQueueSubscriber,
  AiQueueSubscriber,
} from './job-tracker.subscriber';
import { IndexEntityProcessor } from './processors/index-entity.processor';
import { CleanupSoftDeletedAttachmentsProcessor } from './processors/cleanup-soft-deleted-attachments.processor';
// TODO(jobs): enable email drain only after replacing the stub email driver with real delivery.
// import { DrainEmailNotificationsProcessor } from './processors/drain-email-notifications.processor';
import { CleanupScheduler } from './schedulers/cleanup.scheduler';
import { JobLogPruneScheduler } from './schedulers/job-log-prune.scheduler';
import { JobsController } from './jobs.controller';
import { buildBullBoard } from './bull-board.adapter';
import { ExpressAdapter } from '@bull-board/express';
import { Comment } from '../comment/comment.entity';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { UserEntity } from '../user/user.entity';
import { TaskEntity } from '../task/task.entity';
import { ProjectEntity } from '../project/project.entity';
import { TaskLabelEntity } from '../task/task-label.entity';
import { DocumentEntity } from '../document/document.entity';
import { Attachment } from '../attachment/attachment.entity';
import { SearchModule } from '../search/search.module';

const QUEUE_NAMES = Object.values(QUEUES);

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 3600, count: 100 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const redis = cfg.get<{
          host: string;
          port: number;
          password?: string;
        }>('redis');
        return {
          // BullMQ manages queue namespaces itself. Passing ioredis
          // `keyPrefix` corrupts the internal keys used by moveToFinished.
          prefix: cfg.get<string>('BULLMQ_PREFIX', 'jitre'),
          connection: {
            host: redis?.host ?? 'localhost',
            port: redis?.port ?? 6379,
            password: redis?.password,
          },
        };
      },
    }),
    ...QUEUE_NAMES.map((name) =>
      BullModule.registerQueue({ name, defaultJobOptions }),
    ),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      JobLog,
      // Entities needed by IndexEntityProcessor
      Comment,
      WorkspaceEntity,
      UserEntity,
      TaskEntity,
      ProjectEntity,
      TaskLabelEntity,
      DocumentEntity,
      Attachment,
    ]),
    SearchModule,
  ],
  providers: [
    JobLogService,
    DefaultQueueSubscriber,
    EmailQueueSubscriber,
    CleanupQueueSubscriber,
    SearchIndexerQueueSubscriber,
    AnalyticsQueueSubscriber,
    AiQueueSubscriber,
    IndexEntityProcessor,
    CleanupSoftDeletedAttachmentsProcessor,
    // DrainEmailNotificationsProcessor, // blocked by stub EmailNotificationDriver
    CleanupScheduler,
    JobLogPruneScheduler,
    {
      provide: BULL_BOARD_ADAPTER,
      inject: [ConfigService, ...QUEUE_NAMES.map((n) => `BullQueue_${n}`)],
      useFactory: (
        cfg: ConfigService,
        ...queues: unknown[]
      ): ExpressAdapter | null => {
        const enabled =
          cfg.get<boolean>('ENABLE_BULL_BOARD') === true ||
          String(process.env.ENABLE_BULL_BOARD).toLowerCase() === 'true';
        if (!enabled) return null;
        return buildBullBoard(queues as import('bullmq').Queue[]);
      },
    },
  ],
  controllers: [JobsController],
  exports: [
    JobLogService,
    ...QUEUE_NAMES.map((n) => BullModule.registerQueue({ name: n })),
  ],
})
export class JobsModule implements NestModule {
  constructor(private readonly cfg: ConfigService) {}

  configure(consumer: MiddlewareConsumer): void {
    const enabled =
      this.cfg.get<boolean>('ENABLE_BULL_BOARD') === true ||
      String(process.env.ENABLE_BULL_BOARD).toLowerCase() === 'true';

    if (!enabled) return;

    // Auth and role middleware fire BEFORE the Bull Board router,
    // which is mounted separately in main.ts via app.use().
    // We register the path-level middleware here to enforce guard order.
    // (see guard-order test in jobs.controller.spec.ts)
    consumer.apply().forRoutes('/api/v1/admin/queues');
  }
}
