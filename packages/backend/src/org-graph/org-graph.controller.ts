import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceRole } from '@jitre/shared';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { OrgGraph, OrgGraphService } from './org-graph.service';
import { AddReportDto } from './dto/add-report.dto';
import { UserReportsToEntity } from './user-reports-to.entity';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('org-graph')
@ApiBearerAuth('access-token')
@ApiSecurity('workspace')
@Controller('workspaces')
export class OrgGraphController {
  constructor(private readonly orgGraphService: OrgGraphService) {}

  @ApiOperation({
    summary: 'Get the org-graph (members + reports-to edges) of a workspace',
  })
  @ApiResponse({ status: 200, description: 'Nodes + edges.' })
  @ApiResponse({ status: 403, description: 'WORKSPACE_MISMATCH' })
  @Get(':id/org-graph')
  async getOrgGraph(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ): Promise<OrgGraph> {
    this.assertWorkspaceMatch(id, req);
    return this.orgGraphService.getOrgGraph(id);
  }

  @ApiOperation({
    summary: 'Create a reports-to relationship (requires ADMIN role)',
  })
  @ApiResponse({ status: 201, description: 'Relationship created.' })
  @ApiResponse({ status: 400, description: 'SELF_REPORT_FORBIDDEN' })
  @ApiResponse({ status: 404, description: 'USER_NOT_IN_WORKSPACE' })
  @ApiResponse({ status: 409, description: 'DIRECT_CYCLE' })
  @Post(':id/reports')
  @RequireRole(WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async addReport(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddReportDto,
    @Req() req: AuthRequest,
  ): Promise<UserReportsToEntity> {
    this.assertWorkspaceMatch(id, req);
    return this.orgGraphService.addReport(
      id,
      dto.userId,
      dto.supervisorId,
      req.user!.id,
    );
  }

  @ApiOperation({
    summary: 'Soft-delete a reports-to relationship (requires ADMIN role)',
  })
  @ApiResponse({ status: 204, description: 'Relationship removed.' })
  @ApiResponse({ status: 404, description: 'REPORT_NOT_FOUND' })
  @Delete(':id/reports/:userId/supervisor/:supervisorId')
  @RequireRole(WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeReport(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('supervisorId', new ParseUUIDPipe()) supervisorId: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    this.assertWorkspaceMatch(id, req);
    await this.orgGraphService.removeReport(id, userId, supervisorId);
  }

  private assertWorkspaceMatch(id: string, req: AuthRequest): void {
    if (req.workspace?.id !== id) {
      throw new ForbiddenException('WORKSPACE_MISMATCH');
    }
  }
}
