import {
  Body,
  Controller,
  Delete,
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
import { TaskChecklistService } from './task-checklist.service';
import { CreateTaskChecklistItemDto } from './dto/create-task-checklist-item.dto';
import { UpdateTaskChecklistItemDto } from './dto/update-task-checklist-item.dto';
import { SetTaskChecklistItemStatusDto } from './dto/set-task-checklist-item-status.dto';
import { ReorderTaskChecklistItemsDto } from './dto/reorder-task-checklist-items.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('task-checklist')
@ApiBearerAuth('access-token')
@Controller('tasks/:taskId/checklist')
export class TaskChecklistController {
  constructor(private readonly service: TaskChecklistService) {}

  @ApiOperation({ summary: 'List checklist items for a task' })
  @ApiResponse({ status: 200, description: 'Items ordered by `order` ASC.' })
  @Get()
  async list(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ): Promise<unknown[]> {
    return this.service.list(taskId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Add a checklist item' })
  @ApiResponse({ status: 201, description: 'Item created.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskChecklistItemDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.service.create({
      workspaceId: req.workspace!.id,
      taskId,
      content: dto.content,
      order: dto.order,
    });
  }

  @ApiOperation({ summary: 'Edit checklist item content' })
  @ApiResponse({ status: 200, description: 'Item updated.' })
  @Patch(':id')
  async update(
    @Param('taskId') _taskId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskChecklistItemDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.service.update(id, req.workspace!.id, { content: dto.content });
  }

  @ApiOperation({
    summary: 'Set checklist item status (QA validation)',
    description:
      'Stamps completedByUserId + completedAt when status leaves pending; clears them when reset to pending.',
  })
  @ApiResponse({ status: 200, description: 'Status updated.' })
  @Patch(':id/status')
  async setStatus(
    @Param('taskId') _taskId: string,
    @Param('id') id: string,
    @Body() dto: SetTaskChecklistItemStatusDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.service.setStatus(id, req.workspace!.id, req.user!.id, dto.status);
  }

  @ApiOperation({ summary: 'Reorder checklist items' })
  @ApiResponse({ status: 204, description: 'Reordered.' })
  @Post('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorder(
    @Param('taskId') taskId: string,
    @Body() dto: ReorderTaskChecklistItemsDto,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.service.reorder(taskId, req.workspace!.id, dto.orderedIds);
  }

  @ApiOperation({ summary: 'Soft-delete a checklist item' })
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
