import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, QueryFailedError, In } from 'typeorm';
import { TaskLinkEntity, TaskLinkType, TASK_LINK_TYPES } from './task-link.entity';
import { TaskEntity } from './task.entity';

export interface CreateTaskLinkInput {
  workspaceId: string;
  actorUserId: string;
  sourceTaskId: string;
  targetTaskId: string;
  linkType: TaskLinkType;
}

/**
 * Symmetric task linking.
 *
 * Storage is directional (source -> target with a linkType), but for "soft"
 * symmetric types (`relates_to`, `duplicates`, `clones`) we expose both ends
 * of any pair when listing links for a task. `blocks` stays directional —
 * "A blocks B" implies "B is blocked by A" but is rendered explicitly on the
 * UI side, the storage row only exists once.
 */
@Injectable()
export class TaskLinkService {
  constructor(
    @InjectRepository(TaskLinkEntity)
    private readonly repo: Repository<TaskLinkEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
  ) {}

  async list(taskId: string, workspaceId: string): Promise<TaskLinkEntity[]> {
    const rows = await this.repo.find({
      where: [
        { sourceTaskId: taskId, workspaceId, deletedAt: IsNull() },
        { targetTaskId: taskId, workspaceId, deletedAt: IsNull() },
      ],
      order: { createdAt: 'ASC' },
    });
    return rows;
  }

  /**
   * Hydrate links with the "other side" task title so the UI can render a
   * label without a second round-trip.
   */
  async listWithTitles(
    taskId: string,
    workspaceId: string,
  ): Promise<
    Array<{
      id: string;
      direction: 'outgoing' | 'incoming';
      linkType: TaskLinkType;
      otherTaskId: string;
      otherTaskTitle: string | null;
      createdAt: Date;
    }>
  > {
    const links = await this.list(taskId, workspaceId);
    if (links.length === 0) return [];
    const otherIds = Array.from(
      new Set(
        links.map((l) => (l.sourceTaskId === taskId ? l.targetTaskId : l.sourceTaskId)),
      ),
    );
    const tasks = await this.taskRepo.find({
      where: { id: In(otherIds), workspaceId },
      select: ['id', 'title'],
    });
    const titleById = new Map(tasks.map((t) => [t.id, t.title]));
    return links.map((l) => {
      const outgoing = l.sourceTaskId === taskId;
      const otherId = outgoing ? l.targetTaskId : l.sourceTaskId;
      return {
        id: l.id,
        direction: outgoing ? 'outgoing' : 'incoming',
        linkType: l.linkType,
        otherTaskId: otherId,
        otherTaskTitle: titleById.get(otherId) ?? null,
        createdAt: l.createdAt,
      };
    });
  }

  async create(input: CreateTaskLinkInput): Promise<TaskLinkEntity> {
    if (input.sourceTaskId === input.targetTaskId) {
      throw new BadRequestException('LINK_SAME_TASK');
    }
    if (!TASK_LINK_TYPES.includes(input.linkType)) {
      throw new BadRequestException('LINK_TYPE_INVALID');
    }

    // Both tasks must live in the same workspace.
    const tasks = await this.taskRepo.find({
      where: { id: In([input.sourceTaskId, input.targetTaskId]), workspaceId: input.workspaceId },
      select: ['id'],
    });
    if (tasks.length !== 2) throw new NotFoundException('TASK_NOT_FOUND');

    const entity = this.repo.create({
      workspaceId: input.workspaceId,
      sourceTaskId: input.sourceTaskId,
      targetTaskId: input.targetTaskId,
      linkType: input.linkType,
      // createdBy is filled by AuditSubscriber from request context.
    });
    try {
      return await this.repo.save(entity);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code: string }).code === '23505'
      ) {
        throw new ConflictException('LINK_EXISTS');
      }
      throw err;
    }
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, workspaceId, deletedAt: IsNull() },
    });
    if (!found) throw new NotFoundException('LINK_NOT_FOUND');
    await this.repo.softDelete(id);
  }
}
