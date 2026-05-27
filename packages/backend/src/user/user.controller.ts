import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  NotFoundException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceRole } from '@jitre/shared';
import { UserService } from './user.service';
import { SkipTenancy } from '../auth/decorators/skip-tenancy.decorator';
import { AttachmentService } from '../attachment/attachment.service';
import { AttachmentContext } from '@jitre/shared';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly attachmentService: AttachmentService,
  ) {}

  @ApiOperation({
    summary:
      'Get the authenticated user profile (no workspace context required)',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user without passwordHash.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Get('me')
  @SkipTenancy()
  async getMe(@Req() req: Request): Promise<unknown> {
    const reqWithUser = req as Request & { user?: { id: string } };
    const userId = reqWithUser.user?.id;

    const user = await this.userService.findById(userId!);
    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    const { passwordHash: _, ...safeUser } = user as unknown as Record<
      string,
      unknown
    >;
    return safeUser;
  }

  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Updated user without passwordHash.' })
  @ApiResponse({ status: 409, description: 'EMAIL_TAKEN' })
  @Patch('me')
  @SkipTenancy()
  async patchMe(
    @Req() req: Request,
    @Body() dto: UpdateUserDto,
  ): Promise<unknown> {
    const reqWithUser = req as Request & { user?: { id: string } };
    const userId = reqWithUser.user?.id;
    if (!userId) throw new NotFoundException('USER_NOT_FOUND');
    const updated = await this.userService.updateProfile(userId, {
      ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.emailMentions !== undefined ? { emailMentions: dto.emailMentions } : {}),
      ...(dto.emailAssignments !== undefined ? { emailAssignments: dto.emailAssignments } : {}),
      ...(dto.emailDueDates !== undefined ? { emailDueDates: dto.emailDueDates } : {}),
    });
    const { passwordHash: _, ...safeUser } = updated as unknown as Record<
      string,
      unknown
    >;
    return safeUser;
  }

  @ApiOperation({ summary: 'Upload or replace the current user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Avatar updated.' })
  @Post('me/avatar')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    const attachment = await this.attachmentService.replaceAvatar({
      file: {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      context: AttachmentContext.USER_AVATAR,
      contextId: req.user!.id,
      uploaderUserId: req.user!.id,
      workspaceId: req.workspace!.id,
    });
    // Inline the uploaded bytes as a data URL on users.avatarUrl so any `<img
    // src>` can render without juggling signed-URL plumbing. Mirrors what
    // employee.controller does — see the note there for the reasoning.
    const avatarUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const updated = await this.userService.updateEmployee(req.user!.id, {
      avatarUrl,
    });
    const { passwordHash: _, ...safe } = updated as unknown as Record<
      string,
      unknown
    >;
    return { attachment, user: safe };
  }
}
