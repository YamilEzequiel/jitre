import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  ActivityTimelineService,
  ActivityItem,
} from './activity-timeline.service';
import { RequestContextService } from '../request-context/request-context.service';
import type { Page } from '../audit/audit-log.service';
import { ListActivityDto } from './dto/list-activity.dto';

@ApiTags('activity')
@ApiBearerAuth('access-token')
@Controller('activity')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityTimelineService,
    private readonly requestContext: RequestContextService,
  ) {}

  @ApiOperation({
    summary: 'List workspace activity timeline (all authenticated members)',
  })
  @ApiResponse({ status: 200, description: 'Paginated activity items.' })
  @Get()
  async list(@Query() query: ListActivityDto): Promise<Page<ActivityItem>> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.activityService.list(workspaceId, {
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @ApiOperation({ summary: 'List activity for a specific subject' })
  @ApiResponse({ status: 200, description: 'Filtered activity items.' })
  @Get(':subjectType/:subjectId')
  async listBySubject(
    @Param('subjectType') subjectType: string,
    @Param('subjectId') subjectId: string,
    @Query() query: ListActivityDto,
  ): Promise<Page<ActivityItem>> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.activityService.listForSubject(
      workspaceId,
      subjectType,
      subjectId,
      {
        page: query.page,
        pageSize: query.pageSize,
      },
    );
  }
}
