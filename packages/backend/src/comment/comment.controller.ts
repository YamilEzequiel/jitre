import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { CommentSource, WorkspaceRole } from '@jitre/shared';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ListCommentsDto } from './dto/list-comments.dto';

const COMMENT_SOURCE_VALUES = new Set<string>(Object.values(CommentSource));

function parseCommentSource(raw: string | undefined): CommentSource {
  const value = raw?.trim().toLowerCase();
  if (value && COMMENT_SOURCE_VALUES.has(value)) {
    return value as CommentSource;
  }
  return CommentSource.WEB;
}

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('comments')
@ApiBearerAuth('access-token')
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @ApiOperation({ summary: 'Create a comment (root or reply)' })
  @ApiResponse({ status: 201, description: 'Comment created.' })
  @ApiResponse({
    status: 400,
    description: 'MAX_THREAD_DEPTH or validation error.',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCommentDto,
    @Req() req: AuthRequest,
    @Headers('x-jitre-source') sourceHeader?: string,
  ): Promise<unknown> {
    return this.commentService.create({
      workspaceId: req.workspace!.id,
      contextType: dto.contextType,
      contextId: dto.contextId,
      authorUserId: req.user!.id,
      body: dto.body,
      parentId: dto.parentId,
      source: parseCommentSource(sourceHeader),
    });
  }

  @ApiOperation({ summary: 'List comments for a context (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated comment list.' })
  @Get()
  async list(
    @Query() dto: ListCommentsDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.commentService.list({
      workspaceId: req.workspace!.id,
      contextType: dto.contextType,
      contextId: dto.contextId,
      page: dto.page,
      limit: dto.limit,
    });
  }

  @ApiOperation({ summary: 'Get a single comment by ID' })
  @ApiResponse({ status: 200, description: 'Comment found.' })
  @ApiResponse({ status: 404, description: 'COMMENT_NOT_FOUND.' })
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.commentService.findOne(id, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Update comment body (author only, 7-day window)' })
  @ApiResponse({ status: 200, description: 'Comment updated.' })
  @ApiResponse({
    status: 403,
    description: 'INSUFFICIENT_PERMISSION or EDIT_WINDOW_EXPIRED.',
  })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.commentService.update({
      id,
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      actorRole: req.workspace!.role,
      newBody: dto.body,
    });
  }

  @ApiOperation({ summary: 'Soft-delete a comment (author or ADMIN)' })
  @ApiResponse({ status: 204, description: 'Comment deleted.' })
  @ApiResponse({ status: 403, description: 'INSUFFICIENT_PERMISSION.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.commentService.remove({
      id,
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      actorRole: req.workspace!.role,
    });
  }
}
