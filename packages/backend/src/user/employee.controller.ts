import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AttachmentContext, WorkspaceRole } from '@jitre/shared';
import { UserService } from './user.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AttachmentService } from '../attachment/attachment.service';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

function isWorkspaceAdmin(role: WorkspaceRole | undefined): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

/**
 * Employees module — admin-facing CRUD over the user profile for everyone in
 * the current workspace. Routes live under /employees but the underlying
 * persistence is the `users` table plus the workspace membership join.
 *
 * Permissions:
 * - list (GET /): any workspace member can browse the directory.
 * - read one (GET /:id): any workspace member.
 * - update (PATCH /:id): only OWNER/ADMIN of the workspace, OR the user
 *   editing their own record (subset of fields).
 * - upload avatar (POST /:id/avatar): same as update.
 *
 * The TenancyInterceptor already enforces that the actor is a member of the
 * x-workspace-id; we additionally check role here for write operations.
 */
@ApiTags('employees')
@ApiBearerAuth('access-token')
@Controller('employees')
export class EmployeeController {
  constructor(
    private readonly userService: UserService,
    private readonly attachmentService: AttachmentService,
  ) {}

  @ApiOperation({ summary: 'List employees (workspace members with profile data)' })
  @ApiResponse({ status: 200, description: 'Array of employees, sorted by name.' })
  @Get()
  async list(@Req() req: AuthRequest): Promise<unknown[]> {
    return this.userService.listEmployees(req.workspace!.id);
  }

  @ApiOperation({ summary: 'Get a single employee by id' })
  @ApiResponse({ status: 200, description: 'Employee record.' })
  @ApiResponse({ status: 404, description: 'USER_NOT_FOUND.' })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<unknown> {
    const user = await this.userService.findById(id);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    const { passwordHash: _, ...safe } = user as unknown as Record<string, unknown>;
    return safe;
  }

  @ApiOperation({ summary: 'Update an employee (admin or self)' })
  @ApiResponse({ status: 200, description: 'Updated employee.' })
  @ApiResponse({ status: 403, description: 'Not allowed to edit this user.' })
  @ApiResponse({ status: 409, description: 'EMAIL_TAKEN.' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    const isAdmin = isWorkspaceAdmin(req.workspace!.role);
    const isSelf = req.user!.id === id;
    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('EMPLOYEE_EDIT_FORBIDDEN');
    }
    // Non-admins editing themselves cannot change role-sensitive fields like
    // employeeCode / department / position. Strip them silently — clearer
    // than 403 since the form may not show them in self-edit mode.
    const patch = isAdmin
      ? dto
      : ({
          displayName: dto.displayName,
          email: dto.email,
          phone: dto.phone,
          birthDate: dto.birthDate,
          address: dto.address,
          bio: dto.bio,
          emergencyContact: dto.emergencyContact,
        } as UpdateEmployeeDto);

    const updated = await this.userService.updateEmployee(id, patch);
    const { passwordHash: _, ...safe } = updated as unknown as Record<string, unknown>;
    return safe;
  }

  @ApiOperation({ summary: 'Upload or replace an employee avatar (admin or self)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Avatar updated.' })
  @ApiResponse({ status: 403, description: 'Not allowed.' })
  @Post(':id/avatar')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    const isAdmin = isWorkspaceAdmin(req.workspace!.role);
    const isSelf = req.user!.id === id;
    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('EMPLOYEE_EDIT_FORBIDDEN');
    }
    return this.attachmentService.replaceAvatar({
      file: {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      context: AttachmentContext.USER_AVATAR,
      contextId: id,
      uploaderUserId: req.user!.id,
      workspaceId: req.workspace!.id,
    });
  }
}
