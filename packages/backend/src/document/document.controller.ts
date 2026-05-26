import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceRole } from '@jitre/shared';
import { AbilityGuard } from '../auth/guards/ability.guard';
import { RequireAbility } from '../auth/decorators/require-ability.decorator';
import type { AppAbility } from '../auth/casl/ability.types';
import { DocumentService, DocumentTreeNode } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { MoveDocumentDto } from './dto/move-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('documents')
@ApiBearerAuth('access-token')
@Controller('documents')
@UseGuards(AbilityGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @ApiOperation({ summary: 'Return the document tree for the workspace' })
  @ApiResponse({ status: 200, description: 'Document tree.' })
  @Get('tree')
  @RequireAbility((ability: AppAbility) => ability.can('read', 'Document'))
  async tree(
    @Query('projectId') projectId: string | undefined,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    const project =
      projectId === 'null' || projectId === '' ? null : projectId;
    const nodes = await this.documentService.tree(req.workspace!.id, project);
    return nodes.map((node) => this.toTreeDocument(node));
  }

  private toTreeDocument(node: DocumentTreeNode): Record<string, unknown> {
    return {
      ...node.document,
      children: node.children.map((child) => this.toTreeDocument(child)),
    };
  }

  @ApiOperation({ summary: 'List documents (flat, filterable)' })
  @ApiResponse({ status: 200, description: 'Document list.' })
  @Get()
  @RequireAbility((ability: AppAbility) => ability.can('read', 'Document'))
  async list(
    @Query() dto: ListDocumentsDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.documentService.list({
      workspaceId: req.workspace!.id,
      projectId: dto.projectId,
      parentId: dto.parentId,
      q: dto.q,
    });
  }

  @ApiOperation({ summary: 'Get a single document by id' })
  @ApiResponse({ status: 200, description: 'Document found.' })
  @ApiResponse({ status: 404, description: 'DOCUMENT_NOT_FOUND.' })
  @Get(':id')
  @RequireAbility((ability: AppAbility) => ability.can('read', 'Document'))
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.documentService.findOne(id, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Create a document' })
  @ApiResponse({ status: 201, description: 'Document created.' })
  @Post()
  @RequireAbility((ability: AppAbility) => ability.can('create', 'Document'))
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateDocumentDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.documentService.create({
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      title: dto.title,
      projectId: dto.projectId ?? null,
      parentId: dto.parentId ?? null,
      content: dto.content,
      icon: dto.icon ?? null,
      order: dto.order,
    });
  }

  @ApiOperation({ summary: 'Update a document' })
  @ApiResponse({ status: 200, description: 'Document updated.' })
  @ApiResponse({ status: 404, description: 'DOCUMENT_NOT_FOUND.' })
  @Patch(':id')
  @RequireAbility((ability: AppAbility) => ability.can('update', 'Document'))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.documentService.update({
      id,
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      title: dto.title,
      content: dto.content,
      icon: dto.icon,
      order: dto.order,
    });
  }

  @ApiOperation({ summary: 'Move a document (reparent / reorder)' })
  @ApiResponse({ status: 200, description: 'Document moved.' })
  @ApiResponse({
    status: 400,
    description: 'CYCLE_DETECTED or PARENT_PROJECT_MISMATCH.',
  })
  @Patch(':id/move')
  @RequireAbility((ability: AppAbility) => ability.can('update', 'Document'))
  async move(
    @Param('id') id: string,
    @Body() dto: MoveDocumentDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.documentService.move({
      id,
      workspaceId: req.workspace!.id,
      actorUserId: req.user!.id,
      parentId: dto.parentId,
      order: dto.order,
    });
  }

  @ApiOperation({ summary: 'Soft-delete a document and its descendants' })
  @ApiResponse({ status: 204, description: 'Document deleted.' })
  @Delete(':id')
  @RequireAbility((ability: AppAbility) => ability.can('delete', 'Document'))
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.documentService.remove(id, req.workspace!.id, req.user!.id);
  }
}
