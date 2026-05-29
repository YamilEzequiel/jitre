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
import type { Request } from 'express';
import { ProjectService } from './project.service';
import { ProjectMembershipService } from './project-membership/project-membership.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: string };
};

@ApiTags('projects')
@ApiBearerAuth('access-token')
@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly membershipService: ProjectMembershipService,
  ) {}

  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created.' })
  @ApiResponse({ status: 400, description: 'Invalid key format.' })
  @ApiResponse({ status: 403, description: 'Insufficient role.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateProjectDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.projectService.create({
      ...dto,
      workspaceId: req.workspace!.id,
      ownerUserId: req.user!.id,
    });
  }

  @ApiOperation({ summary: 'List projects in the current workspace' })
  @ApiResponse({ status: 200, description: 'Array of projects.' })
  @Get()
  async list(@Req() req: AuthRequest): Promise<unknown[]> {
    return this.projectService.list(req.workspace!.id);
  }

  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiResponse({ status: 200, description: 'Project found.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: AuthRequest): Promise<unknown> {
    return this.projectService.getById(id, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Update project (key is immutable)' })
  @ApiResponse({ status: 200, description: 'Project updated.' })
  @ApiResponse({ status: 403, description: 'Insufficient role.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiSecurity('workspace')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.projectService.update(id, req.workspace!.id, {
      ...dto,
      actorUserId: req.user!.id,
    });
  }

  @ApiOperation({ summary: 'Archive a project (blocks if active tasks exist)' })
  @ApiResponse({ status: 200, description: 'Project archived.' })
  @ApiResponse({ status: 403, description: 'Insufficient role.' })
  @ApiResponse({ status: 409, description: 'Active tasks exist.' })
  @ApiSecurity('workspace')
  @Delete(':id')
  async archive(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.projectService.archive(id, req.workspace!.id, { actorUserId: req.user!.id });
  }

  @ApiOperation({ summary: 'Add a member to the project' })
  @ApiResponse({ status: 201, description: 'Member added (or role updated).' })
  @ApiResponse({ status: 403, description: 'Insufficient project role.' })
  @ApiSecurity('workspace')
  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Param('id') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    await this.projectService.getById(projectId, req.workspace!.id);
    return this.membershipService.addMember(
      projectId,
      req.workspace!.id,
      dto.userId,
      dto.role,
      req.user!.id,
    );
  }

  @ApiOperation({ summary: 'Remove a member from the project' })
  @ApiResponse({ status: 200, description: 'Member removed.' })
  @ApiResponse({ status: 409, description: 'Last admin — cannot remove.' })
  @ApiSecurity('workspace')
  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.projectService.getById(projectId, req.workspace!.id);
    await this.membershipService.removeMember(projectId, req.workspace!.id, userId, req.user!.id);
  }

  @ApiOperation({ summary: 'Change a member role' })
  @ApiResponse({ status: 200, description: 'Role updated.' })
  @ApiResponse({ status: 409, description: 'Cannot demote last admin.' })
  @ApiSecurity('workspace')
  @Patch(':id/members/:userId')
  async updateMember(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateProjectMemberDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    await this.projectService.getById(projectId, req.workspace!.id);
    return this.membershipService.changeRole(
      projectId,
      req.workspace!.id,
      userId,
      dto.role,
      req.user!.id,
    );
  }

  @ApiOperation({ summary: 'List project members' })
  @ApiResponse({ status: 200, description: 'Array of memberships.' })
  @Get(':id/members')
  async listMembers(
    @Param('id') projectId: string,
    @Req() req: AuthRequest,
  ): Promise<unknown[]> {
    await this.projectService.getById(projectId, req.workspace!.id);
    return this.membershipService.listMembers(projectId, req.workspace!.id);
  }
}
