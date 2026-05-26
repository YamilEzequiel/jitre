import { Controller, Get, Param, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WorkspaceRole } from '@jitre/shared';
import { AuditLogService, Page } from './audit-log.service';
import { AuditLog } from './audit-log.entity';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { RequestContextService } from '../request-context/request-context.service';

class PagingQuery {
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

@ApiTags('audit-logs')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly requestContext: RequestContextService,
  ) {}

  @ApiOperation({ summary: 'List workspace audit logs (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries.' })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_ROLE' })
  @Get()
  @RequireRole(WorkspaceRole.ADMIN)
  async list(@Query() query: PagingQuery): Promise<Page<AuditLog>> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.auditLogService.findByWorkspace(workspaceId, {
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @ApiOperation({
    summary: 'List audit logs for a specific subject (ADMIN only)',
  })
  @ApiResponse({ status: 200, description: 'Filtered audit log entries.' })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_ROLE' })
  @Get(':subjectType/:subjectId')
  @RequireRole(WorkspaceRole.ADMIN)
  async listBySubject(
    @Param('subjectType') subjectType: string,
    @Param('subjectId') subjectId: string,
    @Query() query: PagingQuery,
  ): Promise<Page<AuditLog>> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    return this.auditLogService.findBySubject(
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
