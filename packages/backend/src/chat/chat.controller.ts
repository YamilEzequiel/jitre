import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { WorkspaceRole } from '@jitre/shared';
import { ChatService } from './chat.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { CreateDmDto } from './dto/create-dm.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';

type AuthRequest = Request & {
  user?: { id: string };
  workspace?: { id: string; role: WorkspaceRole };
};

@ApiTags('chat')
@ApiBearerAuth('access-token')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ── Channels ────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List chat channels visible to current user' })
  @ApiResponse({ status: 200 })
  @Get('channels')
  async listChannels(@Req() req: AuthRequest): Promise<unknown> {
    return this.chatService.listChannels(req.workspace!.id, req.user!.id);
  }

  @ApiOperation({ summary: 'Create a chat channel' })
  @ApiResponse({ status: 201 })
  @Post('channels')
  @HttpCode(HttpStatus.CREATED)
  async createChannel(
    @Body() dto: CreateChannelDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.createChannel(
      req.workspace!.id,
      req.user!.id,
      dto,
    );
  }

  @ApiOperation({ summary: 'Open (or create) a DM channel with another user' })
  @ApiResponse({ status: 201 })
  @Post('dm')
  @HttpCode(HttpStatus.CREATED)
  async createOrGetDm(
    @Body() dto: CreateDmDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.createOrGetDm(
      req.workspace!.id,
      req.user!.id,
      dto.otherUserId,
    );
  }

  @ApiOperation({ summary: 'Get one channel by id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'CHANNEL_NOT_FOUND' })
  @Get('channels/:id')
  async getChannel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.getChannel(id, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Resolve the chat channel linked to a project' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'PROJECT_CHANNEL_NOT_FOUND' })
  @Get('projects/:projectId/channel')
  async getProjectChannel(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.getProjectChannel(projectId, req.workspace!.id);
  }

  @ApiOperation({ summary: 'Update channel name/description' })
  @ApiResponse({ status: 200 })
  @Patch('channels/:id')
  async updateChannel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateChannelDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.updateChannel(id, req.workspace!.id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a channel' })
  @ApiResponse({ status: 204 })
  @Delete('channels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChannel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.chatService.deleteChannel(id, req.workspace!.id);
  }

  // ── Members ─────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Add a member to a channel' })
  @ApiResponse({ status: 201 })
  @Post('channels/:id/members')
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Param('id', new ParseUUIDPipe()) channelId: string,
    @Body() dto: AddMemberDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.addMember(channelId, req.workspace!.id, dto.userId);
  }

  @ApiOperation({ summary: 'Remove a member from a channel' })
  @ApiResponse({ status: 204 })
  @Delete('channels/:id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', new ParseUUIDPipe()) channelId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.chatService.removeMember(channelId, req.workspace!.id, userId);
  }

  // ── Messages ────────────────────────────────────────────────────────────

  @ApiOperation({
    summary:
      'List messages in a channel, cursor-paginated (DESC by createdAt). Use ?before=<messageId>',
  })
  @ApiResponse({ status: 200 })
  @Get('channels/:id/messages')
  async listMessages(
    @Param('id', new ParseUUIDPipe()) channelId: string,
    @Query() dto: ListMessagesDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.listMessages(channelId, req.workspace!.id, dto);
  }

  @ApiOperation({ summary: 'Send a message in a channel' })
  @ApiResponse({ status: 201 })
  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.sendMessage(req.workspace!.id, req.user!.id, dto);
  }

  @ApiOperation({ summary: 'Edit a message (author only)' })
  @ApiResponse({ status: 200 })
  @Patch('messages/:id')
  async editMessage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EditMessageDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.editMessage(
      id,
      req.workspace!.id,
      req.user!.id,
      dto,
    );
  }

  @ApiOperation({ summary: 'Delete a message (author or workspace admin)' })
  @ApiResponse({ status: 204 })
  @Delete('messages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMessage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    await this.chatService.deleteMessage(
      id,
      req.workspace!.id,
      req.user!.id,
      req.workspace!.role,
    );
  }

  // ── Read state / search ─────────────────────────────────────────────────

  @ApiOperation({ summary: 'Mark a channel as read up to a message' })
  @ApiResponse({ status: 200 })
  @Post('channels/:id/read')
  async markAsRead(
    @Param('id', new ParseUUIDPipe()) channelId: string,
    @Body() dto: MarkReadDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.markAsRead(
      channelId,
      req.workspace!.id,
      req.user!.id,
      dto.messageId,
    );
  }

  @ApiOperation({ summary: 'Unread message count for the current user' })
  @ApiResponse({ status: 200 })
  @Get('channels/:id/unread-count')
  async getUnreadCount(
    @Param('id', new ParseUUIDPipe()) channelId: string,
    @Req() req: AuthRequest,
  ): Promise<{ count: number }> {
    const count = await this.chatService.getUnreadCount(
      channelId,
      req.workspace!.id,
      req.user!.id,
    );
    return { count };
  }

  @ApiOperation({ summary: 'Search messages (ILIKE)' })
  @ApiResponse({ status: 200 })
  @Get('search')
  async searchMessages(
    @Query() dto: SearchMessagesDto,
    @Req() req: AuthRequest,
  ): Promise<unknown> {
    return this.chatService.searchMessages(
      req.workspace!.id,
      req.user!.id,
      dto.q,
      dto.limit,
    );
  }
}
