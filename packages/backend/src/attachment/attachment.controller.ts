import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceRole } from '@jitre/shared';
import { AttachmentService } from './attachment.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('attachments')
@ApiBearerAuth('access-token')
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @ApiOperation({ summary: 'Upload an attachment (multipart/form-data)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Attachment created.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.attachmentService.upload({
      file: {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      context: dto.context,
      contextId: dto.contextId,
      uploaderUserId: req.user!.id,
      workspaceId: req.workspace!.id,
    });
  }

  @ApiOperation({ summary: 'Get attachment metadata by ID' })
  @ApiResponse({ status: 200, description: 'Attachment metadata.' })
  @ApiResponse({ status: 404, description: 'ATTACHMENT_NOT_FOUND' })
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.attachmentService.findByIdScoped(id, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Get a signed download URL for an attachment' })
  @ApiResponse({ status: 200, description: 'Signed download URL.' })
  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.attachmentService.download(id, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Soft-delete an attachment' })
  @ApiResponse({ status: 204, description: 'Attachment deleted.' })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_PERMISSION' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.attachmentService.softDelete(
      id,
      req.user!.id,
      req.workspace!.role,
      req.workspace!.id,
    );
  }
}
