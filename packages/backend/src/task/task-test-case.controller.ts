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
import { TaskTestCaseService } from './task-test-case.service';
import { CreateTaskTestCaseDto } from './dto/create-task-test-case.dto';
import { UpdateTaskTestCaseDto } from './dto/update-task-test-case.dto';
import { SetTaskTestCaseStatusDto } from './dto/set-task-test-case-status.dto';
import { ReorderTaskTestCasesDto } from './dto/reorder-task-test-cases.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('task-test-cases')
@ApiBearerAuth('access-token')
@Controller('tasks/:taskId/test-cases')
export class TaskTestCaseController {
  constructor(private readonly service: TaskTestCaseService) {}

  @ApiOperation({ summary: 'List test cases for a task' })
  @ApiResponse({ status: 200, description: 'Test cases ordered by `order` ASC.' })
  @Get()
  async list(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ): Promise<unknown[]> {
    return this.service.list(taskId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Add a test case' })
  @ApiResponse({ status: 201, description: 'Test case created.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskTestCaseDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.service.create({
      workspaceId: req.workspace!.id,
      taskId,
      title: dto.title,
      precondition: dto.precondition,
      steps: dto.steps,
      expected: dto.expected,
      order: dto.order,
    });
  }

  @ApiOperation({ summary: 'Edit a test case' })
  @ApiResponse({ status: 200, description: 'Test case updated.' })
  @Patch(':id')
  async update(
    @Param('taskId') _taskId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskTestCaseDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.service.update(id, req.workspace!.id, {
      title: dto.title,
      precondition: dto.precondition,
      steps: dto.steps,
      expected: dto.expected,
    });
  }

  @ApiOperation({
    summary: 'Set test case status (QA execution result)',
    description:
      'Stamps completedByUserId + completedAt when status leaves pending; clears them when reset to pending.',
  })
  @ApiResponse({ status: 200, description: 'Status updated.' })
  @Patch(':id/status')
  async setStatus(
    @Param('taskId') _taskId: string,
    @Param('id') id: string,
    @Body() dto: SetTaskTestCaseStatusDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.service.setStatus(
      id,
      req.workspace!.id,
      req.user!.id,
      dto.status,
    );
  }

  @ApiOperation({ summary: 'Reorder test cases' })
  @ApiResponse({ status: 204, description: 'Reordered.' })
  @Post('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorder(
    @Param('taskId') taskId: string,
    @Body() dto: ReorderTaskTestCasesDto,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.service.reorder(taskId, req.workspace!.id, dto.orderedIds);
  }

  @ApiOperation({ summary: 'Soft-delete a test case' })
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
