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
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceRole } from '@jitre/shared';
import { TimeEntryService } from './time-entry.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { ListTimeEntriesDto } from './dto/list-time-entries.dto';
import { StartTimerDto } from './dto/start-timer.dto';
import { TimeReportQueryDto } from './dto/time-report.query.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('time-tracking')
@ApiBearerAuth('access-token')
@Controller()
export class TimeEntryController {
  constructor(private readonly timeEntryService: TimeEntryService) {}

  // ---------------------------------------------------------------------
  // Time entries CRUD
  // ---------------------------------------------------------------------

  @ApiOperation({ summary: 'Create a manual time entry' })
  @ApiResponse({ status: 201, description: 'Time entry created.' })
  @Post('time-entries')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTimeEntryDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.timeEntryService.create({
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      taskId: dto.taskId,
      durationMinutes: dto.durationMinutes,
      date: dto.date,
      description: dto.description,
      billable: dto.billable,
    });
  }

  @ApiOperation({ summary: 'List time entries (filtered, scoped to caller unless admin)' })
  @ApiResponse({ status: 200, description: 'Time entries.' })
  @Get('time-entries')
  async list(
    @Query() query: ListTimeEntriesDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.timeEntryService.list({
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      actorRole: req.workspace!.role,
      userId: query.userId,
      taskId: query.taskId,
      projectId: query.projectId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      billable: query.billable,
    });
  }

  // Timer endpoints declared BEFORE `:id` so Nest routes them first.
  @ApiOperation({ summary: 'Start a new timer (auto-stops any existing one)' })
  @ApiResponse({ status: 201, description: 'Timer started.' })
  @Post('time-entries/timer/start')
  @HttpCode(HttpStatus.CREATED)
  async startTimer(
    @Body() dto: StartTimerDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.timeEntryService.startTimer({
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      taskId: dto.taskId,
      description: dto.description,
      billable: dto.billable,
    });
  }

  @ApiOperation({ summary: 'Stop the current user’s active timer' })
  @ApiResponse({ status: 200, description: 'Timer stopped.' })
  @ApiResponse({ status: 404, description: 'NO_ACTIVE_TIMER.' })
  @Post('time-entries/timer/stop')
  @HttpCode(HttpStatus.OK)
  async stopTimer(@Req() req: AuthRequest): Promise<unknown> {
    return this.timeEntryService.stopActiveTimer(
      req.workspace!.id,
      req.user!.id,
    );
  }

  @ApiOperation({ summary: 'Get the active timer for the current user (or null)' })
  @ApiResponse({ status: 200, description: 'Active timer or null.' })
  @Get('time-entries/timer/active')
  async getActiveTimer(@Req() req: AuthRequest): Promise<unknown> {
    return this.timeEntryService.getActiveTimer(req.user!.id);
  }

  @ApiOperation({ summary: 'Report (admins can group across users; non-admins are scoped to self)' })
  @ApiResponse({ status: 200, description: 'Aggregated report rows.' })
  @Get('time-entries/report')
  async report(
    @Query() query: TimeReportQueryDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.timeEntryService.report({
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      actorRole: req.workspace!.role,
      groupBy: query.groupBy,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      userId: query.userId,
      projectId: query.projectId,
    });
  }

  @ApiOperation({ summary: 'Get a single time entry' })
  @ApiResponse({ status: 200, description: 'Time entry.' })
  @ApiResponse({ status: 404, description: 'TIME_ENTRY_NOT_FOUND.' })
  @Get('time-entries/:id')
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.timeEntryService.getById(id, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Update a time entry (owner or admin only)' })
  @ApiResponse({ status: 200, description: 'Time entry updated.' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_NOT_OWNER.' })
  @Patch('time-entries/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTimeEntryDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.timeEntryService.update({
      id,
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      actorRole: req.workspace!.role,
      durationMinutes: dto.durationMinutes,
      date: dto.date,
      description: dto.description,
      billable: dto.billable,
    });
  }

  @ApiOperation({ summary: 'Delete a time entry (owner or admin only)' })
  @ApiResponse({ status: 204, description: 'Time entry deleted.' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_NOT_OWNER.' })
  @Delete('time-entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.timeEntryService.delete({
      id,
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      actorRole: req.workspace!.role,
    });
  }

  // ---------------------------------------------------------------------
  // Task-scoped summary endpoint
  // ---------------------------------------------------------------------

  @ApiOperation({
    summary: 'Time summary for a task — total + entries (entries scoped to caller unless admin)',
  })
  @ApiResponse({ status: 200, description: 'Summary.' })
  @Get('tasks/:taskId/time-summary')
  async taskSummary(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.timeEntryService.summaryForTask(
      taskId,
      req.workspace!.id,
      req.user!.id,
      req.workspace!.role,
    );
  }
}
