import { Injectable } from '@nestjs/common';
import { RequestContextService } from '../request-context/request-context.service';
import { WorkspaceRole } from '@jitre/shared';
import { DateRangeHelper } from './helpers/date-range.helper';
import { VelocityQuery } from './queries/velocity.query';
import { ThroughputQuery } from './queries/throughput.query';
import { LeadTimeQuery } from './queries/lead-time.query';
import { CycleTimeQuery } from './queries/cycle-time.query';
import { WorkloadQuery } from './queries/workload.query';
import { BurndownQuery } from './queries/burndown.query';
import { StatusFlowQuery } from './queries/status-flow.query';
import { ProjectMembershipService } from '../project/project-membership/project-membership.service';
import type {
  TimeSeriesPointDto,
  DurationStatsDto,
  WorkloadBucketDto,
  BurndownPointDto,
  StatusFlowEdgeDto,
} from './dto';
import type { AnalyticsPeriod } from './helpers/time-bucket.helper';

export interface ProjectAnalyticsInput {
  scope: 'project';
  projectId: string;
  period: AnalyticsPeriod;
  from: string;
  to: string;
}

export interface WorkspaceAnalyticsInput {
  scope: 'workspace';
  period: AnalyticsPeriod;
  from: string;
  to: string;
}

export type VelocityInput = WorkspaceAnalyticsInput | ProjectAnalyticsInput;

/**
 * Orchestrates domain analytics queries.
 * - Validates date range before every query (short-circuit on RANGE_TOO_LARGE)
 * - Applies ADR-6 membership filter for workspace-scope non-admin users
 * - Tenancy from RequestContextService
 */
@Injectable()
export class DomainAnalyticsService {
  constructor(
    private readonly velocityQuery: VelocityQuery,
    private readonly throughputQuery: ThroughputQuery,
    private readonly leadTimeQuery: LeadTimeQuery,
    private readonly cycleTimeQuery: CycleTimeQuery,
    private readonly workloadQuery: WorkloadQuery,
    private readonly burndownQuery: BurndownQuery,
    private readonly statusFlowQuery: StatusFlowQuery,
    private readonly membershipService: ProjectMembershipService,
    private readonly requestContext: RequestContextService,
  ) {}

  private get workspaceId(): string {
    return this.requestContext.getWorkspaceId() ?? '';
  }

  private get userId(): string {
    return this.requestContext.getUserId() ?? '';
  }

  private get isAdmin(): boolean {
    const role = this.requestContext.getRole();
    return role === WorkspaceRole.ADMIN || role === WorkspaceRole.OWNER;
  }

  private async getProjectIds(): Promise<string[]> {
    if (this.isAdmin) return [];
    return this.membershipService.findProjectIdsForUser(
      this.workspaceId,
      this.userId,
    );
  }

  async velocity(input: VelocityInput): Promise<TimeSeriesPointDto[]> {
    DateRangeHelper.validate(input.from, input.to);
    const wsId = this.workspaceId;

    if (input.scope === 'project') {
      return this.velocityQuery.execute({
        workspaceId: wsId,
        period: input.period,
        from: input.from,
        to: input.to,
        projectId: input.projectId,
      });
    }

    const projectIds = await this.getProjectIds();
    return this.velocityQuery.execute({
      workspaceId: wsId,
      period: input.period,
      from: input.from,
      to: input.to,
      ...(projectIds.length > 0 ? { projectIds } : {}),
    });
  }

  async throughput(
    input: WorkspaceAnalyticsInput,
  ): Promise<TimeSeriesPointDto[]> {
    DateRangeHelper.validate(input.from, input.to);
    await this.getProjectIds();
    return this.throughputQuery.execute({
      workspaceId: this.workspaceId,
      period: input.period,
      from: input.from,
      to: input.to,
    });
  }

  async leadTime(input: ProjectAnalyticsInput): Promise<DurationStatsDto[]> {
    DateRangeHelper.validate(input.from, input.to);
    return this.leadTimeQuery.execute({
      workspaceId: this.workspaceId,
      period: input.period,
      from: input.from,
      to: input.to,
      projectId: input.projectId,
    });
  }

  async cycleTime(input: ProjectAnalyticsInput): Promise<DurationStatsDto[]> {
    DateRangeHelper.validate(input.from, input.to);
    return this.cycleTimeQuery.execute({
      workspaceId: this.workspaceId,
      period: input.period,
      from: input.from,
      to: input.to,
      projectId: input.projectId,
    });
  }

  async workload(input: {
    groupBy: 'assignee' | 'status';
    projectId?: string;
  }): Promise<WorkloadBucketDto[]> {
    return this.workloadQuery.execute({
      workspaceId: this.workspaceId,
      groupBy: input.groupBy,
      projectId: input.projectId,
    });
  }

  async burndown(input: {
    projectId: string;
    from: string;
    to: string;
    endOfDay?: boolean;
  }): Promise<BurndownPointDto[]> {
    DateRangeHelper.validate(input.from, input.to);
    return this.burndownQuery.execute({
      workspaceId: this.workspaceId,
      projectId: input.projectId,
      from: input.from,
      to: input.to,
      endOfDay: input.endOfDay,
    });
  }

  async statusFlow(input: {
    projectId: string;
    from: string;
    to: string;
  }): Promise<{ edges: StatusFlowEdgeDto[]; isLimitHit: boolean }> {
    DateRangeHelper.validate(input.from, input.to);
    return this.statusFlowQuery.executeWithMeta({
      workspaceId: this.workspaceId,
      projectId: input.projectId,
      from: input.from,
      to: input.to,
    });
  }
}
