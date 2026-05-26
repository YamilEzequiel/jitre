import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Query helpers — Domain
import { VelocityQuery } from './queries/velocity.query';
import { ThroughputQuery } from './queries/throughput.query';
import { LeadTimeQuery } from './queries/lead-time.query';
import { CycleTimeQuery } from './queries/cycle-time.query';
import { WorkloadQuery } from './queries/workload.query';
import { BurndownQuery } from './queries/burndown.query';
import { StatusFlowQuery } from './queries/status-flow.query';

// Query helpers — AI
import { AiUsageQuery } from './ai-queries/ai-usage.query';
import { AiUsageByUserQuery } from './ai-queries/ai-usage-by-user.query';
import { AiUsageByOperationQuery } from './ai-queries/ai-usage-by-operation.query';
import { AiUsageFailureRateQuery } from './ai-queries/ai-usage-failure-rate.query';

// Services
import { DomainAnalyticsService } from './domain-analytics.service';
import { AiAnalyticsService } from './ai-analytics.service';

// Interceptors
import { AnalyticsCacheInterceptor } from './analytics-cache.interceptor';

// Controllers
import { AnalyticsController } from './analytics.controller';
import { ProjectAnalyticsController } from './project-analytics.controller';
import { WorkspaceStatsController } from './workspace-stats.controller';

// Entities used by lightweight workspace-stats endpoint
import { TaskEntity } from '../task/task.entity';
import { ProjectEntity } from '../project/project.entity';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';
import { StatusEntity } from '../project/status/status.entity';
import { CaslAbilityFactory } from '../auth/casl/ability.factory';

// Upstream modules
import { ProjectModule } from '../project/project.module';
import { RequestContextModule } from '../request-context/request-context.module';
import { WorkspaceModule } from '../workspace/workspace.module';

/**
 * Fase 8 — Analytics module.
 * Read-only on-demand analytics over existing domain + AI data.
 * No new storage tables — pure QueryBuilder reads.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      ProjectEntity,
      WorkspaceMembershipEntity,
      StatusEntity,
    ]),
    ProjectModule,
    RequestContextModule,
    WorkspaceModule,
  ],
  providers: [
    // Domain queries
    VelocityQuery,
    ThroughputQuery,
    LeadTimeQuery,
    CycleTimeQuery,
    WorkloadQuery,
    BurndownQuery,
    StatusFlowQuery,
    // AI queries
    AiUsageQuery,
    AiUsageByUserQuery,
    AiUsageByOperationQuery,
    AiUsageFailureRateQuery,
    // Services
    DomainAnalyticsService,
    AiAnalyticsService,
    // Interceptors
    AnalyticsCacheInterceptor,
    // Required by AbilityGuard instantiated on analytics controllers.
    CaslAbilityFactory,
    Logger,
  ],
  controllers: [
    AnalyticsController,
    ProjectAnalyticsController,
    WorkspaceStatsController,
  ],
  exports: [DomainAnalyticsService, AiAnalyticsService],
})
export class AnalyticsModule {}
