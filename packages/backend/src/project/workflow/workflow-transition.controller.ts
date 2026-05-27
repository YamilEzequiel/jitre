import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceRole } from '@jitre/shared';
import { WorkflowTransitionService } from './workflow-transition.service';
import { CreateTransitionDto } from './dto/create-transition.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

function isWorkspaceAdmin(role: WorkspaceRole | undefined): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

@ApiTags('workflow')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/workflow/transitions')
export class WorkflowTransitionController {
  constructor(private readonly service: WorkflowTransitionService) {}

  @ApiOperation({ summary: 'List workflow transitions for a project' })
  @ApiResponse({ status: 200, description: 'Array of transitions.' })
  @Get()
  async list(
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ): Promise<unknown[]> {
    return this.service.list(projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Create a workflow transition (admin only)' })
  @ApiResponse({ status: 201, description: 'Transition created.' })
  @ApiResponse({ status: 409, description: 'TRANSITION_EXISTS.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTransitionDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    if (!isWorkspaceAdmin(req.workspace!.role)) {
      throw new ForbiddenException('WORKFLOW_EDIT_FORBIDDEN');
    }
    return this.service.create({
      workspaceId: req.workspace!.id,
      projectId,
      fromStatusId: dto.fromStatusId,
      toStatusId: dto.toStatusId,
      requiresAssignee: dto.requiresAssignee,
      label: dto.label,
    });
  }

  @ApiOperation({ summary: 'Delete a workflow transition (admin only)' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    if (!isWorkspaceAdmin(req.workspace!.role)) {
      throw new ForbiddenException('WORKFLOW_EDIT_FORBIDDEN');
    }
    await this.service.remove(id, projectId, req.workspace!.id);
  }
}
