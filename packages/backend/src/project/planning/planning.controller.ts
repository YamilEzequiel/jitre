import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { PlanningService } from './planning.service';
import { PlanningItemEntity, PlanningItemType } from './planning-item.entity';

class CreatePlanningItemDto {
  @IsIn(['epic', 'sprint', 'release'])
  type!: PlanningItemType;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  goal?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: Date | null;

  @IsOptional()
  @IsDateString()
  endDate?: Date | null;
}

class UpdatePlanningItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  goal?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: Date | null;

  @IsOptional()
  @IsDateString()
  endDate?: Date | null;
}

type AuthRequest = Request & { workspace?: { id: string } };

@ApiTags('planning')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get()
  @ApiOperation({ summary: 'List project epics, sprints and releases' })
  list(
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
    @Query('type') type?: PlanningItemType,
  ): Promise<PlanningItemEntity[]> {
    return this.planningService.list(projectId, req.workspace!.id, type);
  }

  @Post()
  @ApiOperation({ summary: 'Create an epic, sprint or release' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePlanningItemDto,
    @Req() req: AuthRequest,
  ): Promise<PlanningItemEntity> {
    return this.planningService.create({
      workspaceId: req.workspace!.id,
      projectId,
      ...dto,
    });
  }

  @Patch(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePlanningItemDto,
    @Req() req: AuthRequest,
  ): Promise<PlanningItemEntity> {
    return this.planningService.update(id, projectId, req.workspace!.id, dto);
  }

  @Delete(':id')
  async delete(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.planningService.delete(id, projectId, req.workspace!.id);
  }
}
