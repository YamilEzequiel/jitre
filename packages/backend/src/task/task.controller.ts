import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TaskService, ListTasksFilter } from './task.service';
import { TaskAssignmentService } from './task-assignment.service';
import { TaskLabelService } from './task-label.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { AddTaskLabelDto } from './dto/add-task-label.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: string };
};

@ApiTags('tasks')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly assignmentService: TaskAssignmentService,
    private readonly labelService: TaskLabelService,
  ) {}

  @ApiOperation({ summary: 'Create a task in the project' })
  @ApiResponse({ status: 201, description: 'Task created.' })
  @ApiResponse({ status: 400, description: 'Invalid custom fields.' })
  @ApiResponse({ status: 403, description: 'Viewer cannot create tasks.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.taskService.create({
      workspaceId: req.workspace!.id,
      projectId,
      statusId: dto.statusId,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      type: dto.type,
      dueDate: dto.dueDate,
      startDate: dto.startDate,
      estimatedHours: dto.estimatedHours,
      parentTaskId: dto.parentTaskId,
      epicId: dto.epicId,
      sprintId: dto.sprintId,
      releaseId: dto.releaseId,
      assigneeUserIds: dto.assigneeUserIds,
      labelIds: dto.labelIds,
      customFields: dto.customFields,
      actorUserId: req.user!.id,
    });
  }

  @ApiOperation({ summary: 'List tasks with filters' })
  @ApiResponse({ status: 200, description: 'Array of tasks.' })
  @ApiQuery({ name: 'statusId', required: false })
  @ApiQuery({ name: 'assigneeUserId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'q', required: false })
  @Get()
  async list(
    @Param('projectId') projectId: string,
    @Query() query: Partial<ListTasksFilter>,
    @Req() req: AuthRequest,
  ): Promise<unknown[]> {
    return this.taskService.list({ ...query, projectId, workspaceId: req.workspace!.id });
  }

  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  @Get(':id')
  async getById(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.taskService.getById(id, projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Non-owner non-admin.' })
  @ApiSecurity('workspace')
  @Patch(':id')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.taskService.update(id, { ...dto, actorUserId: req.user!.id }, projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Delete (soft) a task' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  @ApiSecurity('workspace')
  @Delete(':id')
  async delete(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.taskService.delete(id, req.user!.id, projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Change task status' })
  @ApiResponse({ status: 200 })
  @ApiSecurity('workspace')
  @Patch(':id/status')
  async changeStatus(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: ChangeTaskStatusDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.taskService.changeStatus(id, dto.statusId, req.user!.id, projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Complete a task (shortcut to DONE status)' })
  @ApiResponse({ status: 200 })
  @ApiSecurity('workspace')
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    // Get the first DONE-category status for the project
    // For now delegate to changeStatus with a 'done' marker — handled by service resolving by category
    return this.taskService.complete(id, req.user!.id, projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Assign user to task' })
  @ApiResponse({ status: 201 })
  @ApiSecurity('workspace')
  @Post(':id/assignees')
  @HttpCode(HttpStatus.CREATED)
  async assign(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.assignmentService.assign(id, dto.userId, req.user!.id, projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Unassign user from task' })
  @ApiResponse({ status: 200 })
  @ApiSecurity('workspace')
  @Delete(':id/assignees/:userId')
  async unassign(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.assignmentService.unassign(id, userId, req.user!.id, projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Add label to task' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: 'Wrong scope label.' })
  @ApiSecurity('workspace')
  @Post(':id/labels')
  @HttpCode(HttpStatus.CREATED)
  async addLabel(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: AddTaskLabelDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.labelService.addLabel(id, dto.labelId, req.user!.id, projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Remove label from task' })
  @ApiResponse({ status: 200 })
  @ApiSecurity('workspace')
  @Delete(':id/labels/:labelId')
  async removeLabel(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Param('labelId') labelId: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.labelService.removeLabel(id, labelId, req.user!.id, projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Reorder a task using lexorank' })
  @ApiResponse({ status: 200 })
  @ApiSecurity('workspace')
  @Patch(':id/reorder')
  async reorder(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: ReorderTaskDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.taskService.reorder(id, dto, projectId, req.workspace!.id);
  }
}

@ApiTags('tasks')
@ApiBearerAuth('access-token')
@Controller('tasks')
export class WorkspaceTaskController {
  constructor(private readonly taskService: TaskService) {}

  @ApiOperation({ summary: 'Get a task by ID across the current workspace' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.taskService.getById(id, undefined, req.workspace!.id);
  }
}
