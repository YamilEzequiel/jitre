import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AbilityGuard } from '../auth/guards/ability.guard';
import { RequireAbility } from '../auth/decorators/require-ability.decorator';
import type { AppAbility } from '../auth/casl/ability.types';
import { AnalyticsCacheInterceptor } from './analytics-cache.interceptor';
import { DomainAnalyticsService } from './domain-analytics.service';
import { AiAnalyticsService } from './ai-analytics.service';
import { AnalyticsPeriodDto } from './dto/analytics-period.dto';
import { WorkloadQueryDto } from './dto/workload-query.dto';
import { AiUsageQueryDto } from './dto/ai-usage-query.dto';
import { TimeSeriesPointDto } from './dto/time-series-point.dto';
import { WorkloadBucketDto } from './dto/workload-bucket.dto';
import { AiUsagePointDto } from './dto/ai-usage-point.dto';
import { AiUsageByUserDto } from './dto/ai-usage-by-user.dto';
import { AiUsageByOperationDto } from './dto/ai-usage-by-operation.dto';
import { AiFailureRatePointDto } from './dto/ai-failure-rate-point.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics/workspace')
@UseGuards(JwtAuthGuard, AbilityGuard)
@UseInterceptors(AnalyticsCacheInterceptor)
export class AnalyticsController {
  constructor(
    private readonly domain: DomainAnalyticsService,
    private readonly ai: AiAnalyticsService,
  ) {}

  // ── Domain endpoints (workspace-scoped) ────────────────────────────────────

  @Get('velocity')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_workspace_analytics', 'Workspace'),
  )
  @ApiOperation({ summary: 'Completed tasks per period across the workspace' })
  @ApiResponse({ status: 200, type: TimeSeriesPointDto, isArray: true })
  @ApiResponse({
    status: 400,
    description: 'RANGE_TOO_LARGE | INVALID_RANGE | INVALID_PERIOD',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — missing read_workspace_analytics ability',
  })
  async workspaceVelocity(
    @Query() dto: AnalyticsPeriodDto,
  ): Promise<TimeSeriesPointDto[]> {
    return this.domain.velocity({ scope: 'workspace', ...dto });
  }

  @Get('throughput')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_workspace_analytics', 'Workspace'),
  )
  @ApiOperation({
    summary: 'Tasks transitioned to DONE per period across the workspace',
  })
  @ApiResponse({ status: 200, type: TimeSeriesPointDto, isArray: true })
  @ApiResponse({
    status: 400,
    description: 'RANGE_TOO_LARGE | INVALID_RANGE | INVALID_PERIOD',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async workspaceThroughput(
    @Query() dto: AnalyticsPeriodDto,
  ): Promise<TimeSeriesPointDto[]> {
    return this.domain.throughput({ scope: 'workspace', ...dto });
  }

  @Get('workload')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_workspace_analytics', 'Workspace'),
  )
  @ApiOperation({
    summary: 'Open task count grouped by assignee or status (point-in-time)',
  })
  @ApiResponse({ status: 200, type: WorkloadBucketDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async workspaceWorkload(
    @Query() dto: WorkloadQueryDto,
  ): Promise<WorkloadBucketDto[]> {
    return this.domain.workload(dto);
  }

  // ── AI Analytics endpoints ─────────────────────────────────────────────────

  @Get('ai-usage')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_workspace_analytics', 'Workspace'),
  )
  @ApiOperation({ summary: 'AI usage (requests, cost, tokens) per period' })
  @ApiResponse({ status: 200, type: AiUsagePointDto, isArray: true })
  @ApiResponse({ status: 400, description: 'RANGE_TOO_LARGE | INVALID_RANGE' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async workspaceAiUsage(
    @Query() dto: AiUsageQueryDto,
  ): Promise<AiUsagePointDto[]> {
    return this.ai.aiUsage(dto);
  }

  @Get('ai-usage/by-user')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_ai_analytics_by_user', 'Workspace'),
  )
  @ApiOperation({ summary: 'Top users by AI cost — ADMIN only' })
  @ApiResponse({ status: 200, type: AiUsageByUserDto, isArray: true })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires read_ai_analytics_by_user',
  })
  async workspaceAiUsageByUser(
    @Query() dto: AnalyticsPeriodDto,
  ): Promise<AiUsageByUserDto[]> {
    return this.ai.aiUsageByUser({ from: dto.from, to: dto.to });
  }

  @Get('ai-usage/by-operation')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_workspace_analytics', 'Workspace'),
  )
  @ApiOperation({ summary: 'AI usage grouped by operation type' })
  @ApiResponse({ status: 200, type: AiUsageByOperationDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async workspaceAiUsageByOperation(
    @Query() dto: AnalyticsPeriodDto,
  ): Promise<AiUsageByOperationDto[]> {
    return this.ai.aiUsageByOperation({ from: dto.from, to: dto.to });
  }

  @Get('ai-usage/failure-rate')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_workspace_analytics', 'Workspace'),
  )
  @ApiOperation({ summary: 'AI failure rate per period' })
  @ApiResponse({ status: 200, type: AiFailureRatePointDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async workspaceAiUsageFailureRate(
    @Query() dto: AiUsageQueryDto,
  ): Promise<AiFailureRatePointDto[]> {
    return this.ai.aiUsageFailureRate(dto);
  }
}
