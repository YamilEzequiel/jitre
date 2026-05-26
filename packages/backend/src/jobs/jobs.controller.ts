import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkspaceRole } from '@jitre/shared';
import { JobLogService, JobLogPage } from './job-log.service';
import { JobLogStatus } from './job-log.entity';
import { RequireRole } from '../auth/decorators/require-role.decorator';

class ListJobsQuery {
  @IsOptional()
  @IsString()
  queueName?: string;

  @IsOptional()
  @IsIn(['queued', 'active', 'completed', 'failed'])
  status?: JobLogStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

@ApiTags('jobs')
@ApiBearerAuth('access-token')
@Controller('admin/jobs')
export class JobsController {
  constructor(private readonly jobLogService: JobLogService) {}

  @ApiOperation({ summary: 'List job execution logs (ADMIN+)' })
  @ApiResponse({ status: 200, description: 'Paginated job log entries.' })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_ROLE' })
  @Get()
  @RequireRole(WorkspaceRole.ADMIN)
  async listJobs(@Query() query: ListJobsQuery): Promise<JobLogPage> {
    return this.jobLogService.queryByStatus({
      queueName: query.queueName,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
