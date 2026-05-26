import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiOperation,
  ApiParam,
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
import { AnalyticsPeriodDto } from './dto/analytics-period.dto';
import { BurndownQueryDto } from './dto/burndown-query.dto';
import { TimeSeriesPointDto } from './dto/time-series-point.dto';
import { DurationStatsDto } from './dto/duration-stats.dto';
import { BurndownPointDto } from './dto/burndown-point.dto';
import { StatusFlowEdgeDto } from './dto/status-flow-edge.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics/projects/:projectId')
@UseGuards(JwtAuthGuard, AbilityGuard)
@UseInterceptors(AnalyticsCacheInterceptor)
export class ProjectAnalyticsController {
  constructor(private readonly domain: DomainAnalyticsService) {}

  @Get('velocity')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_project_analytics', 'Project'),
  )
  @ApiOperation({ summary: 'Completed tasks per period for a project' })
  @ApiParam({ name: 'projectId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: TimeSeriesPointDto, isArray: true })
  @ApiResponse({
    status: 400,
    description: 'RANGE_TOO_LARGE | INVALID_RANGE | INVALID_PERIOD',
  })
  @ApiResponse({ status: 403, description: 'Not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async projectVelocity(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() dto: AnalyticsPeriodDto,
  ): Promise<TimeSeriesPointDto[]> {
    return this.domain.velocity({ scope: 'project', projectId, ...dto });
  }

  @Get('lead-time')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_project_analytics', 'Project'),
  )
  @ApiOperation({
    summary: 'Lead time (created→completed) distribution per period',
  })
  @ApiParam({ name: 'projectId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: DurationStatsDto, isArray: true })
  @ApiResponse({ status: 400, description: 'RANGE_TOO_LARGE | INVALID_RANGE' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async projectLeadTime(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() dto: AnalyticsPeriodDto,
  ): Promise<DurationStatsDto[]> {
    return this.domain.leadTime({ scope: 'project', projectId, ...dto });
  }

  @Get('cycle-time')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_project_analytics', 'Project'),
  )
  @ApiOperation({
    summary: 'Cycle time (first non-TODO→completed) distribution per period',
  })
  @ApiParam({ name: 'projectId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: DurationStatsDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async projectCycleTime(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() dto: AnalyticsPeriodDto,
  ): Promise<DurationStatsDto[]> {
    return this.domain.cycleTime({ scope: 'project', projectId, ...dto });
  }

  @Get('burndown')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_project_analytics', 'Project'),
  )
  @ApiOperation({
    summary: 'Remaining open tasks per day (end-of-day semantics, ADR-3)',
  })
  @ApiParam({ name: 'projectId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: BurndownPointDto, isArray: true })
  @ApiResponse({ status: 400, description: 'RANGE_TOO_LARGE | INVALID_RANGE' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async projectBurndown(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() dto: BurndownQueryDto,
  ): Promise<BurndownPointDto[]> {
    return this.domain.burndown({ projectId, ...dto });
  }

  @Get('status-flow')
  @RequireAbility((ability: AppAbility) =>
    ability.can('read_project_analytics', 'Project'),
  )
  @ApiOperation({
    summary:
      'Status transition frequency matrix. Note: period param accepted but ignored (full from-to window used). X-Analytics-Truncated: true if LIMIT 1000 hit.',
  })
  @ApiParam({ name: 'projectId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: StatusFlowEdgeDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async projectStatusFlow(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() dto: AnalyticsPeriodDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StatusFlowEdgeDto[]> {
    const { edges, isLimitHit } = await this.domain.statusFlow({
      projectId,
      from: dto.from,
      to: dto.to,
    });
    if (isLimitHit) {
      res.setHeader('X-Analytics-Truncated', 'true');
    }
    return edges;
  }
}
