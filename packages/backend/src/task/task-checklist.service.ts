import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TaskChecklistItemEntity } from './task-checklist-item.entity';
import { TaskEntity } from './task.entity';
import { TaskChecklistItemStatus } from '@jitre/shared';

export interface CreateChecklistItemInput {
  workspaceId: string;
  taskId: string;
  content: string;
  order?: number;
}

/**
 * CRUD + status transitions for QA checklist items attached to a task.
 *
 * The "trazabilidad" guarantee: every transition out of `pending` stamps
 * `completedByUserId` (the actor who flipped the status) and `completedAt`.
 * Resetting to `pending` clears both — there is no "last QA" memory once a
 * criterion is re-opened, because the previous validation no longer applies.
 */
@Injectable()
export class TaskChecklistService {
  constructor(
    @InjectRepository(TaskChecklistItemEntity)
    private readonly repo: Repository<TaskChecklistItemEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
  ) {}

  async list(
    taskId: string,
    workspaceId: string,
  ): Promise<TaskChecklistItemEntity[]> {
    await this.assertTaskInWorkspace(taskId, workspaceId);
    return this.repo.find({
      where: { taskId, workspaceId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(
    input: CreateChecklistItemInput,
  ): Promise<TaskChecklistItemEntity> {
    await this.assertTaskInWorkspace(input.taskId, input.workspaceId);

    let order = input.order;
    if (order === undefined) {
      const max = await this.repo.maximum('order', {
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      });
      order = max === null || max === undefined ? 0 : Number(max) + 1;
    }

    const entity = this.repo.create({
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      content: input.content,
      status: TaskChecklistItemStatus.PENDING,
      order,
      completedByUserId: null,
      completedAt: null,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    workspaceId: string,
    patch: { content?: string },
  ): Promise<TaskChecklistItemEntity> {
    const item = await this.repo.findOne({
      where: { id, workspaceId, deletedAt: IsNull() },
    });
    if (!item) throw new NotFoundException('CHECKLIST_ITEM_NOT_FOUND');

    if (patch.content !== undefined) item.content = patch.content;
    return this.repo.save(item);
  }

  async setStatus(
    id: string,
    workspaceId: string,
    actorUserId: string,
    status: TaskChecklistItemStatus,
  ): Promise<TaskChecklistItemEntity> {
    const item = await this.repo.findOne({
      where: { id, workspaceId, deletedAt: IsNull() },
    });
    if (!item) throw new NotFoundException('CHECKLIST_ITEM_NOT_FOUND');

    item.status = status;
    if (status === TaskChecklistItemStatus.PENDING) {
      item.completedByUserId = null;
      item.completedAt = null;
    } else {
      item.completedByUserId = actorUserId;
      item.completedAt = new Date();
    }
    return this.repo.save(item);
  }

  async reorder(
    taskId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<void> {
    await this.assertTaskInWorkspace(taskId, workspaceId);

    const existing = await this.repo.find({
      where: { taskId, workspaceId, deletedAt: IsNull() },
    });
    const existingIds = new Set(existing.map((i) => i.id));
    const incomingIds = new Set(orderedIds);

    if (existingIds.size !== incomingIds.size) {
      throw new BadRequestException('CHECKLIST_REORDER_SET_MISMATCH');
    }
    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException('CHECKLIST_REORDER_UNKNOWN_ID');
      }
    }

    const byId = new Map(existing.map((i) => [i.id, i]));
    await Promise.all(
      orderedIds.map((id, index) => {
        const item = byId.get(id)!;
        item.order = index;
        return this.repo.save(item);
      }),
    );
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const item = await this.repo.findOne({
      where: { id, workspaceId, deletedAt: IsNull() },
    });
    if (!item) throw new NotFoundException('CHECKLIST_ITEM_NOT_FOUND');
    await this.repo.softDelete(id);
  }

  private async assertTaskInWorkspace(
    taskId: string,
    workspaceId: string,
  ): Promise<void> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, workspaceId },
    });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');
  }
}
