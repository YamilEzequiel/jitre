import {
  Body,
  Controller,
  Delete,
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
import { TaskLinkService } from './task-link.service';
import { CreateTaskLinkDto } from './dto/create-task-link.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('task-links')
@ApiBearerAuth('access-token')
@Controller('tasks/:taskId/links')
export class TaskLinkController {
  constructor(private readonly service: TaskLinkService) {}

  @ApiOperation({ summary: 'List links for a task (both directions)' })
  @ApiResponse({ status: 200, description: 'Hydrated links.' })
  @Get()
  async list(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ): Promise<unknown[]> {
    return this.service.listWithTitles(taskId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Create a task link' })
  @ApiResponse({ status: 201, description: 'Link created.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskLinkDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.service.create({
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      sourceTaskId: taskId,
      targetTaskId: dto.targetTaskId,
      linkType: dto.linkType,
    });
  }

  @ApiOperation({ summary: 'Delete a task link' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('taskId') _taskId: string,
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.service.remove(id, req.workspace!.id);
  }
}
