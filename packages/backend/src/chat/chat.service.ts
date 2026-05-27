import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { WorkspaceRole, hasAtLeastRole } from '@jitre/shared';
import {
  ChatChannelEntity,
  ChatChannelKind,
  ChatChannelType,
} from './chat-channel.entity';
import { ChatMembershipEntity } from './chat-membership.entity';
import { ChatMessageEntity, ChatMessageAttachment } from './chat-message.entity';
import { EventBusService } from '../events/event-bus.service';
import { ChatMessageCreatedEvent } from './events/chat-message-created.event';
import { ChatMessageEditedEvent } from './events/chat-message-edited.event';
import { ChatMessageDeletedEvent } from './events/chat-message-deleted.event';
import { ProjectEntity } from '../project/project.entity';
import { ProjectMembershipEntity } from '../project/project-membership/project-membership.entity';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';

const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;

export interface ListMessagesResult {
  data: ChatMessageEntity[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface EnsureProjectChannelInput {
  workspaceId: string;
  projectId: string;
  projectName: string;
  actorUserId: string;
  memberUserIds: string[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatChannelEntity)
    private readonly channelRepo: Repository<ChatChannelEntity>,
    @InjectRepository(ChatMembershipEntity)
    private readonly membershipRepo: Repository<ChatMembershipEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(ProjectMembershipEntity)
    private readonly projectMembershipRepo: Repository<ProjectMembershipEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Channels ────────────────────────────────────────────────────────────

  async createChannel(
    workspaceId: string,
    userId: string,
    dto: CreateChannelDto,
  ): Promise<ChatChannelEntity> {
    return this.createStructuredChannel({
      workspaceId,
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type,
      kind: 'custom',
      createdByUserId: userId,
      memberUserIds: [userId, ...(dto.memberUserIds ?? [])],
    });
  }

  /**
   * Find an existing DM channel between two users in a workspace, or create a new one.
   * DM channel naming convention: sort both UUIDs ascending and produce `dm:<a>:<b>`.
   * This guarantees a single DM channel per pair regardless of who initiates it.
   */
  async createOrGetDm(
    workspaceId: string,
    currentUserId: string,
    otherUserId: string,
  ): Promise<ChatChannelEntity> {
    if (currentUserId === otherUserId) {
      throw new BadRequestException('CANNOT_DM_SELF');
    }

    const [a, b] = [currentUserId, otherUserId].sort();
    const dmName = `dm:${a}:${b}`;

    const existing = await this.channelRepo.findOne({
      where: { workspaceId, name: dmName, type: 'dm' },
    });
    if (existing) {
      return existing;
    }

    const channel = this.channelRepo.create({
      workspaceId,
      name: dmName,
      description: null,
      type: 'dm',
      kind: 'dm',
      projectId: null,
      createdByUserId: currentUserId,
      lastMessageAt: null,
    });
    const saved = await this.channelRepo.save(channel);

    await this.membershipRepo.save([
      this.membershipRepo.create({
        channelId: saved.id,
        userId: currentUserId,
        lastReadMessageId: null,
        notificationLevel: 'all',
      }),
      this.membershipRepo.create({
        channelId: saved.id,
        userId: otherUserId,
        lastReadMessageId: null,
        notificationLevel: 'all',
      }),
    ]);

    return saved;
  }

  async ensureGeneralChannel(
    workspaceId: string,
    actorUserId: string,
  ): Promise<ChatChannelEntity> {
    const existing = await this.channelRepo.findOne({
      where: { workspaceId, kind: 'general' },
    });
    if (existing) {
      return existing;
    }

    return this.createStructuredChannel({
      workspaceId,
      name: 'general',
      description: 'Workspace-wide announcements and collaboration',
      type: 'public',
      kind: 'general',
      createdByUserId: actorUserId,
      memberUserIds: [actorUserId],
    });
  }

  async ensureProjectChannel(
    input: EnsureProjectChannelInput,
  ): Promise<ChatChannelEntity> {
    const existing = await this.channelRepo.findOne({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        kind: 'project',
      },
    });
    if (existing) {
      return existing;
    }

    return this.createStructuredChannel({
      workspaceId: input.workspaceId,
      name: this.toProjectChannelName(input.projectName),
      description: `Project chat for ${input.projectName}`,
      type: 'private',
      kind: 'project',
      projectId: input.projectId,
      createdByUserId: input.actorUserId,
      memberUserIds: input.memberUserIds,
    });
  }

  async getProjectChannel(
    projectId: string,
    workspaceId: string,
  ): Promise<ChatChannelEntity> {
    const existing = await this.channelRepo.findOne({
      where: { workspaceId, projectId, kind: 'project' },
    });
    if (existing) {
      return existing;
    }

    const project = await this.projectRepo.findOne({
      where: { id: projectId, workspaceId },
    });
    if (!project) {
      throw new NotFoundException('PROJECT_NOT_FOUND');
    }

    const memberships = await this.projectMembershipRepo.find({
      where: { projectId, workspaceId },
    });

    return this.ensureProjectChannel({
      workspaceId,
      projectId: project.id,
      projectName: project.name,
      actorUserId: project.ownerUserId,
      memberUserIds: memberships.map((membership) => membership.userId),
    });
  }

  /**
   * Channels visible to the user: public workspace channels OR channels the user is a member of.
   * DM and private channels require membership.
   */
  async listChannels(
    workspaceId: string,
    userId: string,
  ): Promise<ChatChannelEntity[]> {
    return this.channelRepo
      .createQueryBuilder('c')
      .leftJoin(
        ChatMembershipEntity,
        'm',
        'm.channel_id = c.id AND m.user_id = :userId',
        { userId },
      )
      .where('c.workspace_id = :workspaceId', { workspaceId })
      .andWhere('c.deleted_at IS NULL')
      .andWhere('(c.type = :pub OR m.user_id IS NOT NULL)', { pub: 'public' })
      .orderBy('c.last_message_at', 'DESC', 'NULLS LAST')
      .addOrderBy('c.created_at', 'DESC')
      .getMany();
  }

  async getChannel(id: string, workspaceId: string): Promise<ChatChannelEntity> {
    const channel = await this.channelRepo.findOne({
      where: { id, workspaceId },
    });
    if (!channel) {
      throw new NotFoundException('CHANNEL_NOT_FOUND');
    }
    return channel;
  }

  async updateChannel(
    id: string,
    workspaceId: string,
    dto: UpdateChannelDto,
  ): Promise<ChatChannelEntity> {
    const channel = await this.getChannel(id, workspaceId);
    if (channel.type === 'dm') {
      throw new BadRequestException('CANNOT_UPDATE_DM');
    }
    if (dto.name !== undefined) channel.name = dto.name;
    if (dto.description !== undefined) channel.description = dto.description;
    if (dto.icon !== undefined) {
      // Normalize empty string to null so the column stays clean.
      channel.icon = dto.icon === '' ? null : dto.icon;
    }
    return this.channelRepo.save(channel);
  }

  async deleteChannel(id: string, workspaceId: string): Promise<void> {
    const channel = await this.getChannel(id, workspaceId);
    if (channel.type === 'dm') {
      throw new BadRequestException('CANNOT_DELETE_DM');
    }
    await this.channelRepo.softDelete(id);
  }

  // ── Memberships ─────────────────────────────────────────────────────────

  async addMember(
    channelId: string,
    workspaceId: string,
    userId: string,
  ): Promise<ChatMembershipEntity> {
    const channel = await this.getChannel(channelId, workspaceId);
    if (channel.type === 'dm') {
      throw new BadRequestException('CANNOT_ADD_MEMBER_TO_DM');
    }
    const existing = await this.membershipRepo.findOne({
      where: { channelId, userId },
    });
    if (existing) {
      return existing;
    }
    const membership = this.membershipRepo.create({
      channelId,
      userId,
      lastReadMessageId: null,
      notificationLevel: 'all',
    });
    return this.membershipRepo.save(membership);
  }

  async removeMember(
    channelId: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const channel = await this.getChannel(channelId, workspaceId);
    if (channel.type === 'dm') {
      throw new BadRequestException('CANNOT_REMOVE_MEMBER_FROM_DM');
    }
    await this.membershipRepo.delete({ channelId, userId });
  }

  async isMember(channelId: string, userId: string): Promise<boolean> {
    const m = await this.membershipRepo.findOne({
      where: { channelId, userId },
    });
    return m !== null;
  }

  async listMembers(
    channelId: string,
    workspaceId: string,
  ): Promise<ChatMembershipEntity[]> {
    await this.getChannel(channelId, workspaceId); // ensures tenant scoping
    return this.membershipRepo.find({ where: { channelId } });
  }

  // ── Messages ────────────────────────────────────────────────────────────

  async sendMessage(
    workspaceId: string,
    authorId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessageEntity> {
    const channel = await this.getChannel(dto.channelId, workspaceId);

    // Public channels: auto-join the author so future ACLs work consistently.
    const member = await this.isMember(dto.channelId, authorId);
    if (!member) {
      if (channel.type === 'public') {
        await this.addMember(dto.channelId, workspaceId, authorId);
      } else {
        throw new ForbiddenException('NOT_A_MEMBER');
      }
    }

    if (dto.parentMessageId) {
      const parent = await this.messageRepo.findOne({
        where: {
          id: dto.parentMessageId,
          workspaceId,
          channelId: dto.channelId,
        },
      });
      if (!parent) {
        throw new NotFoundException('PARENT_MESSAGE_NOT_FOUND');
      }
    }

    const attachments: ChatMessageAttachment[] = (dto.attachments ?? []).map(
      (a) => ({
        id: a.id,
        url: a.url,
        name: a.name,
        size: a.size,
        mimeType: a.mimeType,
      }),
    );

    const message = this.messageRepo.create({
      workspaceId,
      channelId: dto.channelId,
      authorId,
      body: dto.body,
      parentMessageId: dto.parentMessageId ?? null,
      attachments,
      editedAt: null,
    });
    const saved = await this.messageRepo.save(message);

    channel.lastMessageAt = saved.createdAt;
    await this.channelRepo.save(channel);

    this.eventBus.publish(
      new ChatMessageCreatedEvent({
        aggregateId: saved.id,
        aggregateType: 'ChatMessage',
        workspaceId,
        actorUserId: authorId,
        payload: {
          messageId: saved.id,
          channelId: saved.channelId,
          authorId: saved.authorId,
          body: saved.body,
          parentMessageId: saved.parentMessageId,
          attachments: saved.attachments,
          createdAt: saved.createdAt,
        },
      }),
    );

    return saved;
  }

  async editMessage(
    messageId: string,
    workspaceId: string,
    authorId: string,
    dto: EditMessageDto,
  ): Promise<ChatMessageEntity> {
    const message = await this.findMessage(messageId, workspaceId);
    if (message.authorId !== authorId) {
      throw new ForbiddenException('INSUFFICIENT_PERMISSION');
    }
    const previousBody = message.body;
    message.body = dto.body;
    message.editedAt = new Date();
    const saved = await this.messageRepo.save(message);

    this.eventBus.publish(
      new ChatMessageEditedEvent({
        aggregateId: saved.id,
        aggregateType: 'ChatMessage',
        workspaceId,
        actorUserId: authorId,
        payload: {
          messageId: saved.id,
          channelId: saved.channelId,
          authorId: saved.authorId,
          previousBody,
          newBody: saved.body,
          editedAt: saved.editedAt!,
        },
      }),
    );

    return saved;
  }

  async deleteMessage(
    messageId: string,
    workspaceId: string,
    actorUserId: string,
    actorRole: WorkspaceRole,
  ): Promise<void> {
    const message = await this.findMessage(messageId, workspaceId);
    const isAuthor = message.authorId === actorUserId;
    const isAdmin = hasAtLeastRole(actorRole, WorkspaceRole.ADMIN);
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('INSUFFICIENT_PERMISSION');
    }
    await this.messageRepo.softDelete(messageId);

    this.eventBus.publish(
      new ChatMessageDeletedEvent({
        aggregateId: messageId,
        aggregateType: 'ChatMessage',
        workspaceId,
        actorUserId,
        payload: {
          messageId,
          channelId: message.channelId,
          deletedByUserId: actorUserId,
        },
      }),
    );
  }

  /**
   * List messages with cursor-based pagination.
   * `before` is the messageId acting as the cursor — returns messages older than that.
   * Result is ordered DESC by createdAt; default limit 50, max 100.
   */
  async listMessages(
    channelId: string,
    workspaceId: string,
    query: ListMessagesDto,
  ): Promise<ListMessagesResult> {
    await this.getChannel(channelId, workspaceId);
    const limit = Math.min(
      Math.max(1, query.limit ?? DEFAULT_MESSAGE_LIMIT),
      MAX_MESSAGE_LIMIT,
    );

    let createdAtCursor: Date | null = null;
    if (query.before) {
      const cursorMsg = await this.messageRepo.findOne({
        where: { id: query.before, workspaceId, channelId },
      });
      if (cursorMsg) {
        createdAtCursor = cursorMsg.createdAt;
      }
    }

    const data = await this.messageRepo.find({
      where: {
        channelId,
        workspaceId,
        ...(createdAtCursor ? { createdAt: LessThan(createdAtCursor) } : {}),
      },
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });

    const hasMore = data.length > limit;
    const trimmed = hasMore ? data.slice(0, limit) : data;
    const nextCursor =
      hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1]!.id : null;

    return { data: trimmed, hasMore, nextCursor };
  }

  async findMessage(
    messageId: string,
    workspaceId: string,
  ): Promise<ChatMessageEntity> {
    const m = await this.messageRepo.findOne({
      where: { id: messageId, workspaceId },
    });
    if (!m) {
      throw new NotFoundException('MESSAGE_NOT_FOUND');
    }
    return m;
  }

  // ── Read state ──────────────────────────────────────────────────────────

  async markAsRead(
    channelId: string,
    workspaceId: string,
    userId: string,
    messageId: string,
  ): Promise<ChatMembershipEntity> {
    await this.getChannel(channelId, workspaceId);
    const membership = await this.membershipRepo.findOne({
      where: { channelId, userId },
    });
    if (!membership) {
      throw new ForbiddenException('NOT_A_MEMBER');
    }
    // Validate the message belongs to the channel
    const msg = await this.messageRepo.findOne({
      where: { id: messageId, workspaceId, channelId },
    });
    if (!msg) {
      throw new NotFoundException('MESSAGE_NOT_FOUND');
    }
    membership.lastReadMessageId = messageId;
    return this.membershipRepo.save(membership);
  }

  async getUnreadCount(
    channelId: string,
    workspaceId: string,
    userId: string,
  ): Promise<number> {
    await this.getChannel(channelId, workspaceId);
    const membership = await this.membershipRepo.findOne({
      where: { channelId, userId },
    });
    if (!membership) {
      return 0;
    }

    if (!membership.lastReadMessageId) {
      return this.messageRepo.count({
        where: { channelId, workspaceId, deletedAt: IsNull() },
      });
    }

    const lastRead = await this.messageRepo.findOne({
      where: { id: membership.lastReadMessageId, workspaceId, channelId },
    });
    if (!lastRead) {
      return this.messageRepo.count({
        where: { channelId, workspaceId, deletedAt: IsNull() },
      });
    }

    return this.messageRepo
      .createQueryBuilder('m')
      .where('m.channel_id = :channelId', { channelId })
      .andWhere('m.workspace_id = :workspaceId', { workspaceId })
      .andWhere('m.deleted_at IS NULL')
      .andWhere('m.created_at > :ts', { ts: lastRead.createdAt })
      .getCount();
  }

  // ── Search ──────────────────────────────────────────────────────────────

  /**
   * Simple ILIKE search across messages in channels where the user is a member
   * OR channels that are public to the workspace. Not full-text — a future Fase
   * can wire this into the existing FTS infrastructure.
   */
  async searchMessages(
    workspaceId: string,
    userId: string,
    q: string,
    limit = 50,
  ): Promise<ChatMessageEntity[]> {
    const trimmed = q.trim();
    if (trimmed.length === 0) return [];

    return this.messageRepo
      .createQueryBuilder('m')
      .innerJoin(ChatChannelEntity, 'c', 'c.id = m.channel_id')
      .leftJoin(
        ChatMembershipEntity,
        'mb',
        'mb.channel_id = c.id AND mb.user_id = :userId',
        { userId },
      )
      .where('m.workspace_id = :workspaceId', { workspaceId })
      .andWhere('m.deleted_at IS NULL')
      .andWhere('c.deleted_at IS NULL')
      .andWhere('m.body ILIKE :pattern', { pattern: `%${trimmed}%` })
      .andWhere('(c.type = :pub OR mb.user_id IS NOT NULL)', { pub: 'public' })
      .orderBy('m.created_at', 'DESC')
      .limit(Math.min(Math.max(1, limit), MAX_MESSAGE_LIMIT))
      .getMany();
  }

  // ── Test helper / future-use ────────────────────────────────────────────

  /** Returns the channels (by id) where the user is currently a member. */
  async listUserChannelIds(userId: string): Promise<string[]> {
    const rows = await this.membershipRepo.find({ where: { userId } });
    return rows.map((r) => r.channelId);
  }

  private async createStructuredChannel(input: {
    workspaceId: string;
    name: string;
    description: string | null;
    type: ChatChannelType;
    kind: ChatChannelKind;
    createdByUserId: string;
    memberUserIds: string[];
    projectId?: string | null;
  }): Promise<ChatChannelEntity> {
    const channel = this.channelRepo.create({
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      kind: input.kind,
      projectId: input.projectId ?? null,
      createdByUserId: input.createdByUserId,
      lastMessageAt: null,
    });

    const saved = await this.channelRepo.save(channel);

    const memberIds = Array.from(new Set(input.memberUserIds));
    const memberships = memberIds.map((uid) =>
      this.membershipRepo.create({
        channelId: saved.id,
        userId: uid,
        lastReadMessageId: null,
        notificationLevel: 'all',
      }),
    );
    await this.membershipRepo.save(memberships);

    return saved;
  }

  private toProjectChannelName(projectName: string): string {
    return projectName.trim().toLowerCase().replace(/\s+/g, '-');
  }
}
