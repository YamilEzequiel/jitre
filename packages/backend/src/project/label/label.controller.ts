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
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import type { Request } from 'express';
import { LabelService } from './label.service';
import { LabelScope } from '@jitre/shared';

class CreateLabelDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ enum: LabelScope }) @IsEnum(LabelScope) scope!: LabelScope;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string | null;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() projectId?:
    | string
    | null;
}

class UpdateLabelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string | null;
}

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string };
};

@ApiTags('labels')
@ApiBearerAuth('access-token')
@Controller()
export class LabelController {
  constructor(private readonly labelService: LabelService) {}

  @ApiOperation({ summary: 'Create a label' })
  @ApiResponse({ status: 201 })
  @ApiSecurity('workspace')
  @Post('labels')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateLabelDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.labelService.create({
      workspaceId: req.workspace!.id,
      ...dto,
      actorUserId: req.user!.id,
    });
  }

  @ApiOperation({ summary: 'List workspace-scoped labels' })
  @ApiResponse({ status: 200 })
  @Get('labels')
  async listByWorkspace(@Req() req: AuthRequest): Promise<unknown[]> {
    return this.labelService.listByWorkspace(req.workspace!.id);
  }

  @ApiOperation({ summary: 'List project-scoped labels' })
  @ApiResponse({ status: 200 })
  @Get('projects/:projectId/labels')
  async listByProject(
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ): Promise<unknown[]> {
    return this.labelService.listByProject(projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Update a label' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  @ApiSecurity('workspace')
  @Patch('labels/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLabelDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.labelService.update(id, req.workspace!.id, { ...dto, actorUserId: req.user!.id });
  }

  @ApiOperation({ summary: 'Delete a label' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  @ApiSecurity('workspace')
  @Delete('labels/:id')
  async delete(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.labelService.delete(id, req.workspace!.id, { actorUserId: req.user!.id });
  }
}
