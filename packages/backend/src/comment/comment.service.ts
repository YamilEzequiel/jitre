import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentContext, WorkspaceRole, hasAtLeastRole } from '@jitre/shared';
import { Comment } from './comment.entity';
import { EventBusService } from '../events/event-bus.service';
import { MentionParser } from '../mention/mention-parser.service';
import { CommentCreatedEvent } from '../events/events/comment-created.event';
import { CommentUpdatedEvent } from '../events/events/comment-updated.event';
import { CommentDeletedEvent } from '../events/events/comment-deleted.event';
import { MentionCreatedEvent } from '../events/events/mention-created.event';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MENTIONS = 50;

export interface CreateCommentInput {
  workspaceId: string;
  contextType: CommentContext;
  contextId: string;
  authorUserId: string;
  body: string;
  parentId?: string;
}

export interface ListCommentsInput {
  workspaceId: string;
  contextType: CommentContext;
  contextId: string;
  page: number;
  limit: number;
}

export interface UpdateCommentInput {
  id: string;
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceRole;
  newBody: string;
}

export interface RemoveCommentInput {
  id: string;
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceRole;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    private readonly eventBus: EventBusService,
    private readonly mentionParser: MentionParser,
  ) {}

  async create(input: CreateCommentInput): Promise<Comment> {
    const {
      workspaceId,
      contextType,
      contextId,
      authorUserId,
      body,
      parentId,
    } = input;

    if (parentId) {
      const parent = await this.commentRepo.findOne({
        where: { id: parentId, workspaceId },
      });
      if (!parent) {
        throw new NotFoundException('PARENT_COMMENT_NOT_FOUND');
      }
      if (parent.parentId !== null) {
        throw new BadRequestException('MAX_THREAD_DEPTH');
      }
    }

    let mentionedUserIds = this.mentionParser.parse(body).userIds;
    if (mentionedUserIds.length > MAX_MENTIONS) {
      this.logger.warn(
        `Comment body has ${mentionedUserIds.length} mentions — capping at ${MAX_MENTIONS}`,
      );
      mentionedUserIds = mentionedUserIds.slice(0, MAX_MENTIONS);
    }

    const entity = this.commentRepo.create({
      workspaceId,
      contextType,
      contextId,
      authorUserId,
      body,
      parentId: parentId ?? null,
    });

    const saved = await this.commentRepo.save(entity);

    this.eventBus.publish(
      new CommentCreatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Comment',
        workspaceId,
        actorUserId: authorUserId,
        payload: {
          commentId: saved.id,
          contextId,
          context: contextType,
          authorUserId,
          body,
          mentionedUserIds,
          parentId,
        },
      }),
    );

    for (const userId of mentionedUserIds) {
      this.eventBus.publish(
        new MentionCreatedEvent({
          aggregateId: userId,
          aggregateType: 'Mention',
          workspaceId,
          actorUserId: authorUserId,
          payload: {
            mentionedUserId: userId,
            sourceType: 'Comment',
            sourceId: saved.id,
            excerpt: body.slice(0, 200),
          },
        }),
      );
    }

    return saved;
  }

  async list(input: ListCommentsInput): Promise<PaginatedResult<Comment>> {
    const { workspaceId, contextType, contextId, page, limit } = input;

    const [data, total] = await this.commentRepo.findAndCount({
      where: { workspaceId, contextType, contextId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, workspaceId: string): Promise<Comment> {
    const comment = await this.commentRepo.findOne({
      where: { id, workspaceId },
    });
    if (!comment) {
      throw new NotFoundException('COMMENT_NOT_FOUND');
    }
    return comment;
  }

  async update(input: UpdateCommentInput): Promise<Comment> {
    const { id, workspaceId, actorUserId, newBody } = input;

    const comment = await this.findOne(id, workspaceId);

    // Permission check: only the author can edit (ADMIN cannot override edit on behalf)
    if (comment.authorUserId !== actorUserId) {
      throw new ForbiddenException('INSUFFICIENT_PERMISSION');
    }

    // 7-day edit window
    const ageMs = Date.now() - comment.createdAt.getTime();
    if (ageMs > SEVEN_DAYS_MS) {
      throw new ForbiddenException('EDIT_WINDOW_EXPIRED');
    }

    // Mention diff — emit MentionCreatedEvent only for new mentions
    let newMentions = this.mentionParser.parse(newBody).userIds;
    const oldMentions = this.mentionParser.parse(comment.body).userIds;

    const oldSet = new Set(oldMentions.map((id) => id.toLowerCase()));
    const addedMentions = newMentions.filter(
      (uid) => !oldSet.has(uid.toLowerCase()),
    );

    if (addedMentions.length > MAX_MENTIONS) {
      this.logger.warn(
        `Comment update has ${addedMentions.length} new mentions — capping at ${MAX_MENTIONS}`,
      );
      newMentions = newMentions.slice(0, MAX_MENTIONS);
    }

    const previousBody = comment.body;
    comment.body = newBody;

    const saved = await this.commentRepo.save(comment);

    this.eventBus.publish(
      new CommentUpdatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Comment',
        workspaceId,
        actorUserId,
        payload: {
          commentId: saved.id,
          previousBody,
          newBody,
          mentionedUserIds: newMentions,
        },
      }),
    );

    for (const userId of addedMentions) {
      this.eventBus.publish(
        new MentionCreatedEvent({
          aggregateId: userId,
          aggregateType: 'Mention',
          workspaceId,
          actorUserId,
          payload: {
            mentionedUserId: userId,
            sourceType: 'Comment',
            sourceId: saved.id,
            excerpt: newBody.slice(0, 200),
          },
        }),
      );
    }

    return saved;
  }

  async remove(input: RemoveCommentInput): Promise<void> {
    const { id, workspaceId, actorUserId, actorRole } = input;

    const comment = await this.findOne(id, workspaceId);

    const isAuthor = comment.authorUserId === actorUserId;
    const isAdmin = hasAtLeastRole(actorRole, WorkspaceRole.ADMIN);

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('INSUFFICIENT_PERMISSION');
    }

    await this.commentRepo.softDelete(id);

    this.eventBus.publish(
      new CommentDeletedEvent({
        aggregateId: id,
        aggregateType: 'Comment',
        workspaceId,
        actorUserId,
        payload: { commentId: id, actorUserId },
      }),
    );
  }

  /**
   * Fetch multiple comments by IDs, filtered to the given workspace.
   * Used by AiController to load comments for summarization.
   */
  async findByIds(
    ids: string[],
    opts: { workspaceId: string },
  ): Promise<
    Array<{ id: string; body: string; userId: string; createdAt: Date }>
  > {
    if (ids.length === 0) return [];
    const comments = await this.commentRepo.find({
      where: ids.map((id) => ({ id, workspaceId: opts.workspaceId })),
    });
    return comments.map((c) => ({
      id: c.id,
      body: c.body,
      userId: c.authorUserId,
      createdAt: c.createdAt,
    }));
  }
}
