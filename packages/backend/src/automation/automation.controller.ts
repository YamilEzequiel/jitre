import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceRole } from '@jitre/shared';
import { AutomationService } from './automation.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import {
  AutomationAction,
  AutomationCondition,
  AutomationTrigger,
} from './automation.entity';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

function isWorkspaceAdmin(role: WorkspaceRole | undefined): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

@ApiTags('automations')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/automations')
export class AutomationController {
  constructor(private readonly service: AutomationService) {}

  @ApiOperation({ summary: 'List automations for a project' })
  @ApiResponse({ status: 200, description: 'Array of automations.' })
  @Get()
  async list(
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ): Promise<unknown[]> {
    return this.service.list(projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Create an automation (admin)' })
  @ApiResponse({ status: 201, description: 'Created.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAutomationDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    if (!isWorkspaceAdmin(req.workspace!.role)) {
      throw new ForbiddenException('AUTOMATION_EDIT_FORBIDDEN');
    }
    return this.service.create({
      workspaceId: req.workspace!.id,
      projectId,
      name: dto.name,
      description: dto.description,
      trigger: dto.trigger as AutomationTrigger,
      triggerConfig: dto.triggerConfig,
      conditions: dto.conditions as AutomationCondition[] | null | undefined,
      actions: dto.actions as AutomationAction[],
      enabled: dto.enabled,
    });
  }

  @ApiOperation({ summary: 'Update an automation (admin)' })
  @ApiResponse({ status: 200, description: 'Updated.' })
  @Patch(':id')
  async update(
    @Param('projectId') _projectId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAutomationDto>,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    if (!isWorkspaceAdmin(req.workspace!.role)) {
      throw new ForbiddenException('AUTOMATION_EDIT_FORBIDDEN');
    }
    return this.service.update(id, req.workspace!.id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.trigger !== undefined ? { trigger: dto.trigger as AutomationTrigger } : {}),
      ...(dto.triggerConfig !== undefined ? { triggerConfig: dto.triggerConfig } : {}),
      ...(dto.conditions !== undefined
        ? { conditions: dto.conditions as AutomationCondition[] | null }
        : {}),
      ...(dto.actions !== undefined ? { actions: dto.actions as AutomationAction[] } : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
    });
  }

  @ApiOperation({ summary: 'Delete an automation (admin)' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId') _projectId: string,
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    if (!isWorkspaceAdmin(req.workspace!.role)) {
      throw new ForbiddenException('AUTOMATION_EDIT_FORBIDDEN');
    }
    await this.service.remove(id, req.workspace!.id);
  }

  @ApiOperation({ summary: 'List recent runs of an automation' })
  @Get(':id/runs')
  async runs(
    @Param('projectId') _projectId: string,
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown[]> {
    return this.service.listRuns(id, req.workspace!.id);
  }
}
