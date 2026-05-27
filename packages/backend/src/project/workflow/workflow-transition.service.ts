import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, QueryFailedError } from 'typeorm';
import { WorkflowTransitionEntity } from './workflow-transition.entity';
import { StatusEntity } from '../status/status.entity';

export interface CreateTransitionInput {
  workspaceId: string;
  projectId: string;
  fromStatusId: string;
  toStatusId: string;
  requiresAssignee?: boolean;
  label?: string | null;
}

/**
 * Workflow transitions = the allowed status edges of a project's state machine.
 *
 * Behavior contract:
 * - A project with **zero** transition rows operates in "free" mode — any
 *   status change is allowed. This keeps existing projects working without
 *   forcing admins to define a full DAG up front.
 * - As soon as a project has at least one transition row, the machine
 *   activates: only (from -> to) pairs that exist are allowed. Trying to
 *   move into a status that isn't reachable from the current one is rejected
 *   by the task service.
 * - Each transition can optionally require the task to have an assignee
 *   before it's accepted (gate for "you must own it before moving forward").
 */
@Injectable()
export class WorkflowTransitionService {
  constructor(
    @InjectRepository(WorkflowTransitionEntity)
    private readonly repo: Repository<WorkflowTransitionEntity>,
    @InjectRepository(StatusEntity)
    private readonly statusRepo: Repository<StatusEntity>,
  ) {}

  async list(projectId: string, workspaceId: string): Promise<WorkflowTransitionEntity[]> {
    return this.repo.find({
      where: { projectId, workspaceId, deletedAt: IsNull() },
      relations: { fromStatus: true, toStatus: true },
      order: { createdAt: 'ASC' },
    });
  }

  async create(input: CreateTransitionInput): Promise<WorkflowTransitionEntity> {
    if (input.fromStatusId === input.toStatusId) {
      throw new BadRequestException('TRANSITION_SAME_STATUS');
    }

    // Both statuses must belong to this project — otherwise an admin could
    // accidentally wire in a status from another project.
    const [from, to] = await Promise.all([
      this.statusRepo.findOne({
        where: { id: input.fromStatusId, projectId: input.projectId },
      }),
      this.statusRepo.findOne({
        where: { id: input.toStatusId, projectId: input.projectId },
      }),
    ]);
    if (!from || !to) throw new NotFoundException('STATUS_NOT_FOUND');

    const entity = this.repo.create({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      fromStatusId: input.fromStatusId,
      toStatusId: input.toStatusId,
      requiresAssignee: input.requiresAssignee ?? false,
      label: input.label ?? null,
    });
    try {
      return await this.repo.save(entity);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code: string }).code === '23505'
      ) {
        throw new ConflictException('TRANSITION_EXISTS');
      }
      throw err;
    }
  }

  async remove(id: string, projectId: string, workspaceId: string): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, projectId, workspaceId, deletedAt: IsNull() },
    });
    if (!found) throw new NotFoundException('TRANSITION_NOT_FOUND');
    await this.repo.softDelete(id);
  }

  /**
   * Check whether the (from -> to) edge is allowed for a project.
   *
   * Returns the matching transition row when allowed (the caller may need
   * the `requiresAssignee` flag), or `null` when the project has no rules
   * defined at all (free mode). Throws BadRequestException when rules
   * exist but this specific edge isn't in the set.
   */
  async assertAllowed(
    projectId: string,
    workspaceId: string,
    fromStatusId: string,
    toStatusId: string,
  ): Promise<WorkflowTransitionEntity | null> {
    if (fromStatusId === toStatusId) return null;

    const all = await this.repo.find({
      where: { projectId, workspaceId, deletedAt: IsNull() },
      select: ['id', 'fromStatusId', 'toStatusId', 'requiresAssignee'],
    });
    if (all.length === 0) return null; // free mode

    const match = all.find(
      (t) => t.fromStatusId === fromStatusId && t.toStatusId === toStatusId,
    );
    if (!match) throw new BadRequestException('TRANSITION_NOT_ALLOWED');
    return match;
  }
}
