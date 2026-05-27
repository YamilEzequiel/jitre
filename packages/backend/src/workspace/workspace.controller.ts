import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiConsumes,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { SkipTenancy } from '../auth/decorators/skip-tenancy.decorator';
import { AttachmentContext, WorkspaceRole } from '@jitre/shared';
import { AttachmentService } from '../attachment/attachment.service';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('workspaces')
@ApiBearerAuth('access-token')
@Controller('workspaces')
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly attachmentService: AttachmentService,
  ) {}

  @ApiOperation({
    summary: 'Create a new workspace (no workspace context required)',
  })
  @ApiResponse({
    status: 201,
    description: 'Workspace created; caller added as OWNER.',
  })
  @ApiResponse({ status: 409, description: 'SLUG_TAKEN' })
  @Post()
  @SkipTenancy()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateWorkspaceDto,
    @Req() req: Request,
  ): Promise<unknown> {
    const reqWithUser = req as Request & { user?: { id: string } };
    return this.workspaceService.create(reqWithUser.user!.id, dto);
  }

  @ApiOperation({
    summary: 'List workspaces the authenticated user belongs to',
  })
  @ApiResponse({ status: 200, description: 'Array of workspaces.' })
  @Get()
  @SkipTenancy()
  async list(@Req() req: Request): Promise<unknown[]> {
    const reqWithUser = req as Request & { user?: { id: string } };
    return this.workspaceService.listForUser(reqWithUser.user!.id);
  }

  @ApiOperation({ summary: 'List members available for collaboration in this workspace' })
  @ApiSecurity('workspace')
  @ApiResponse({ status: 200, description: 'Array of safe workspace contacts.' })
  @Get(':id/members')
  async listMembers(@Param('id') id: string): Promise<unknown[]> {
    return this.workspaceService.listContacts(id);
  }

  @ApiOperation({
    summary: 'Update workspace details (requires ADMIN role)',
  })
  @ApiSecurity('workspace')
  @ApiResponse({ status: 200, description: 'Workspace updated.' })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_ROLE' })
  @Patch(':id')
  @RequireRole(WorkspaceRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<unknown> {
    return this.workspaceService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Add a member to a workspace (requires ADMIN role)',
  })
  @ApiSecurity('workspace')
  @ApiResponse({ status: 201, description: 'Member added.' })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_ROLE' })
  @ApiResponse({ status: 409, description: 'ALREADY_MEMBER' })
  @Post(':id/members')
  @RequireRole(WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ): Promise<unknown> {
    return this.workspaceService.addMember(id, dto);
  }

  @ApiOperation({
    summary: 'Change a workspace member role (requires ADMIN role)',
  })
  @ApiSecurity('workspace')
  @ApiResponse({ status: 200, description: 'Member role updated.' })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_ROLE / CANNOT_CHANGE_OWN_ROLE / OWNER_REQUIRED' })
  @ApiResponse({ status: 404, description: 'MEMBER_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'LAST_OWNER' })
  @Patch(':id/members/:userId')
  @RequireRole(WorkspaceRole.ADMIN)
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.workspaceService.updateMemberRole(
      id,
      userId,
      dto.role,
      req.user!.id,
      req.workspace!.role,
    );
  }

  @ApiOperation({
    summary: 'Remove a member from a workspace (requires ADMIN role)',
  })
  @ApiSecurity('workspace')
  @ApiResponse({ status: 204, description: 'Member removed.' })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_ROLE' })
  @ApiResponse({ status: 409, description: 'LAST_OWNER' })
  @Delete(':id/members/:userId')
  @RequireRole(WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.workspaceService.removeMember(id, userId);
  }

  @ApiOperation({
    summary: 'Upload or replace the workspace avatar (requires ADMIN role)',
  })
  @ApiSecurity('workspace')
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Avatar updated.' })
  @Post(':id/avatar')
  @RequireRole(WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.attachmentService.replaceAvatar({
      file: {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      context: AttachmentContext.WORKSPACE_AVATAR,
      contextId: id,
      uploaderUserId: req.user!.id,
      workspaceId: id,
    });
  }
}
