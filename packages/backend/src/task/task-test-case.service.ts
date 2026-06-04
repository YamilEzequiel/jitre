import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TaskTestCaseEntity } from './task-test-case.entity';
import { TaskEntity } from './task.entity';
import { TaskTestCaseStatus } from '@jitre/shared';

export interface CreateTestCaseInput {
  workspaceId: string;
  taskId: string;
  title: string;
  precondition?: string | null;
  steps?: string | null;
  expected?: string | null;
  order?: number;
}

export interface UpdateTestCasePatch {
  title?: string;
  precondition?: string | null;
  steps?: string | null;
  expected?: string | null;
}

/**
 * CRUD + status transitions for structured Test Cases attached to a task.
 *
 * Trazabilidad guarantee: every transition out of `pending` stamps
 * `completedByUserId` (the actor who flipped the status) and `completedAt`.
 * Resetting to `pending` clears both — once a case is re-opened, the previous
 * verdict no longer applies.
 */
@Injectable()
export class TaskTestCaseService {
  constructor(
    @InjectRepository(TaskTestCaseEntity)
    private readonly repo: Repository<TaskTestCaseEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
  ) {}

  async list(
    taskId: string,
    workspaceId: string,
  ): Promise<TaskTestCaseEntity[]> {
    await this.assertTaskInWorkspace(taskId, workspaceId);
    return this.repo.find({
      where: { taskId, workspaceId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(input: CreateTestCaseInput): Promise<TaskTestCaseEntity> {
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
      title: input.title,
      precondition: input.precondition ?? null,
      steps: input.steps ?? null,
      expected: input.expected ?? null,
      status: TaskTestCaseStatus.PENDING,
      order,
      completedByUserId: null,
      completedAt: null,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    workspaceId: string,
    patch: UpdateTestCasePatch,
  ): Promise<TaskTestCaseEntity> {
    const item = await this.repo.findOne({
      where: { id, workspaceId, deletedAt: IsNull() },
    });
    if (!item) throw new NotFoundException('TEST_CASE_NOT_FOUND');

    if (patch.title !== undefined) item.title = patch.title;
    if (patch.precondition !== undefined) item.precondition = patch.precondition;
    if (patch.steps !== undefined) item.steps = patch.steps;
    if (patch.expected !== undefined) item.expected = patch.expected;
    return this.repo.save(item);
  }

  async setStatus(
    id: string,
    workspaceId: string,
    actorUserId: string,
    status: TaskTestCaseStatus,
  ): Promise<TaskTestCaseEntity> {
    const item = await this.repo.findOne({
      where: { id, workspaceId, deletedAt: IsNull() },
    });
    if (!item) throw new NotFoundException('TEST_CASE_NOT_FOUND');

    item.status = status;
    if (status === TaskTestCaseStatus.PENDING) {
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
      throw new BadRequestException('TEST_CASE_REORDER_SET_MISMATCH');
    }
    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException('TEST_CASE_REORDER_UNKNOWN_ID');
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
    if (!item) throw new NotFoundException('TEST_CASE_NOT_FOUND');
    await this.repo.softDelete(id);
  }

  /**
   * Bulk-create test cases (used by the AI suggest flow). Each item is created
   * sequentially so the `order` counter increments deterministically.
   */
  async bulkCreate(
    workspaceId: string,
    taskId: string,
    items: Array<{
      title: string;
      precondition?: string | null;
      steps?: string | null;
      expected?: string | null;
    }>,
  ): Promise<TaskTestCaseEntity[]> {
    const created: TaskTestCaseEntity[] = [];
    for (const it of items) {
      created.push(
        await this.create({
          workspaceId,
          taskId,
          title: it.title,
          precondition: it.precondition ?? null,
          steps: it.steps ?? null,
          expected: it.expected ?? null,
        }),
      );
    }
    return created;
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
