import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskEntity } from '../task/task.entity';
import { ProjectEntity } from '../project/project.entity';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';
import { StatusEntity } from '../project/status/status.entity';
import { ProjectStatus, StatusCategory } from '@jitre/shared';
import { RequestContextService } from '../request-context/request-context.service';

interface WorkspaceStats {
  totalTasks: number;
  completedTasks: number;
  openProjects: number;
  teamMembers: number;
}

/**
 * Lightweight dashboard summary. Lives on its own controller path
 * (`/api/v1/analytics/workspace-stats`) — separate from the deeper
 * `/api/v1/analytics/workspace/*` analytics endpoints that require ranges.
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics/workspace-stats')
@UseGuards(JwtAuthGuard)
export class WorkspaceStatsController {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(WorkspaceMembershipEntity)
    private readonly membershipRepo: Repository<WorkspaceMembershipEntity>,
    @InjectRepository(StatusEntity)
    private readonly statusRepo: Repository<StatusEntity>,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard totals: tasks, completed, open projects, team size' })
  @ApiResponse({ status: 200, description: 'Workspace stats counters.' })
  async getStats(): Promise<WorkspaceStats> {
    const workspaceId = this.requestContext.getWorkspaceId() ?? '';
    if (!workspaceId) {
      return { totalTasks: 0, completedTasks: 0, openProjects: 0, teamMembers: 0 };
    }

    const doneStatusIds = (
      await this.statusRepo.find({
        where: { workspaceId, category: StatusCategory.DONE, deletedAt: IsNull() },
        select: ['id'],
      })
    ).map((s) => s.id);

    const [totalTasks, completedTasks, openProjects, teamMembers] = await Promise.all([
      this.taskRepo.count({ where: { workspaceId, deletedAt: IsNull() } }),
      doneStatusIds.length === 0
        ? Promise.resolve(0)
        : this.taskRepo
            .createQueryBuilder('t')
            .where('t.workspace_id = :workspaceId', { workspaceId })
            .andWhere('t.deleted_at IS NULL')
            .andWhere('t.status_id IN (:...ids)', { ids: doneStatusIds })
            .getCount(),
      this.projectRepo.count({
        where: { workspaceId, deletedAt: IsNull(), status: ProjectStatus.ACTIVE },
      }),
      this.membershipRepo.count({ where: { workspaceId, deletedAt: IsNull() } }),
    ]);

    return { totalTasks, completedTasks, openProjects, teamMembers };
  }
}
