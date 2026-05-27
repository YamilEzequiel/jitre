import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceRole } from '@jitre/shared';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { AreaService } from './area.service';
import { AreaEntity } from './area.entity';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('areas')
@ApiBearerAuth('access-token')
@ApiSecurity('workspace')
@Controller('workspaces/:workspaceId/areas')
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  @ApiOperation({ summary: 'List areas in a workspace' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'WORKSPACE_MISMATCH' })
  @Get()
  async list(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Req() req: AuthRequest,
  ): Promise<AreaEntity[]> {
    this.assertWorkspaceMatch(workspaceId, req);
    return this.areaService.list(workspaceId);
  }

  @ApiOperation({ summary: 'Create a new area (requires ADMIN role)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403, description: 'WORKSPACE_MISMATCH / INSUFFICIENT_ROLE' })
  @ApiResponse({ status: 409, description: 'AREA_NAME_TAKEN' })
  @Post()
  @RequireRole(WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: CreateAreaDto,
    @Req() req: AuthRequest,
  ): Promise<AreaEntity> {
    this.assertWorkspaceMatch(workspaceId, req);
    return this.areaService.create(workspaceId, dto, req.user!.id);
  }

  @ApiOperation({ summary: 'Update an area (requires ADMIN role)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'WORKSPACE_MISMATCH / INSUFFICIENT_ROLE' })
  @ApiResponse({ status: 404, description: 'AREA_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'AREA_NAME_TAKEN' })
  @Patch(':id')
  @RequireRole(WorkspaceRole.ADMIN)
  async update(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAreaDto,
    @Req() req: AuthRequest,
  ): Promise<AreaEntity> {
    this.assertWorkspaceMatch(workspaceId, req);
    return this.areaService.update(id, workspaceId, dto);
  }

  @ApiOperation({ summary: 'Soft-delete an area (requires ADMIN role)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'WORKSPACE_MISMATCH / INSUFFICIENT_ROLE' })
  @ApiResponse({ status: 404, description: 'AREA_NOT_FOUND' })
  @Delete(':id')
  @RequireRole(WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    this.assertWorkspaceMatch(workspaceId, req);
    await this.areaService.softDelete(id, workspaceId);
  }

  private assertWorkspaceMatch(workspaceId: string, req: AuthRequest): void {
    if (req.workspace?.id !== workspaceId) {
      throw new ForbiddenException('WORKSPACE_MISMATCH');
    }
  }
}
