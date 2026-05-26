import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Request } from 'express';
import { StatusService } from './status.service';
import { StatusCategory } from '@jitre/shared';

class CreateStatusDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: StatusCategory })
  @IsEnum(StatusCategory)
  category!: StatusCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string | null;
}

class UpdateStatusDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: StatusCategory })
  @IsOptional()
  @IsEnum(StatusCategory)
  category?: StatusCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string | null;
}

class DeleteStatusDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  replaceWithStatusId?: string;
}

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string };
};

@ApiTags('statuses')
@ApiBearerAuth('access-token')
@Controller()
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @ApiOperation({ summary: 'Create a status for a project' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403, description: 'Non-admin project.' })
  @ApiSecurity('workspace')
  @Post('projects/:projectId/statuses')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateStatusDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.statusService.create({
      workspaceId: req.workspace!.id,
      projectId,
      name: dto.name,
      category: dto.category,
      isDefault: dto.isDefault,
      order: dto.order,
      color: dto.color,
      actorUserId: req.user!.id,
    });
  }

  @ApiOperation({
    summary: 'List statuses for a project (+ workspace defaults)',
  })
  @ApiResponse({ status: 200 })
  @Get('projects/:projectId/statuses')
  async listByProject(
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ): Promise<unknown[]> {
    return this.statusService.listByProject(projectId, req.workspace?.id);
  }

  @ApiOperation({ summary: 'Update a status' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  @ApiSecurity('workspace')
  @Patch('statuses/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.statusService.update(id, req.workspace!.id, { ...dto, actorUserId: req.user!.id });
  }

  @ApiOperation({
    summary:
      'Delete a status (replaceWithStatusId required if tasks reference it)',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'replaceWithStatusId required.' })
  @ApiResponse({ status: 404 })
  @ApiSecurity('workspace')
  @Delete('statuses/:id')
  async delete(
    @Param('id') id: string,
    @Body() dto: DeleteStatusDto,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.statusService.delete(id, req.workspace!.id, {
      replaceWithStatusId: dto.replaceWithStatusId,
      actorUserId: req.user!.id,
    });
  }
}
