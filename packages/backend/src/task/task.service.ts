import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TaskEntity } from './task.entity';
import { StatusEntity } from '../project/status/status.entity';
import { ProjectEntity } from '../project/project.entity';
import { PlanningItemEntity, PlanningItemType } from '../project/planning/planning-item.entity';
import { LexorankService } from './lexorank.service';
import { CustomFieldService } from '../project/custom-field/custom-field.service';
import { TaskAssignmentService } from './task-assignment.service';
import { TaskLabelService } from './task-label.service';
import { EventBusService } from '../events/event-bus.service';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskStatusChangedEvent,
  TaskCompletedEvent,
  TaskDeletedEvent,
} from './events';
import { StatusCategory, TaskPriority, TaskType } from '@jitre/shared';

export interface CreateTaskDto {
  workspaceId: string;
  projectId: string;
  statusId: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  type?: TaskType;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimatedHours?: number | null;
  parentTaskId?: string | null;
  epicId?: string | null;
  sprintId?: string | null;
  releaseId?: string | null;
  customFields?: Record<string, unknown>;
  assigneeUserIds?: string[];
  labelIds?: string[];
  actorUserId?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  type?: TaskType;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimatedHours?: number | null;
  epicId?: string | null;
  sprintId?: string | null;
  releaseId?: string | null;
  customFields?: Record<string, unknown>;
  actorUserId?: string;
}

export interface ListTasksFilter {
  workspaceId?: string;
  projectId?: string;
  statusId?: string;
  assigneeUserId?: string;
  labelId?: string;
  priority?: TaskPriority;
  type?: TaskType;
  dueBefore?: Date;
  dueAfter?: Date;
  q?: string;
  page?: number;
  limit?: number;
}

export interface ReorderTaskDto {
  beforeId?: string | null;
  afterId?: string | null;
}

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(StatusEntity)
    private readonly statusRepo: Repository<StatusEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(PlanningItemEntity)
    private readonly planningRepo: Repository<PlanningItemEntity>,
    private readonly lexorank: LexorankService,
    private readonly customFieldService: CustomFieldService,
    private readonly assignmentService: TaskAssignmentService,
    private readonly labelService: TaskLabelService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateTaskDto): Promise<TaskEntity> {
    await this.validateStatusLink(dto.statusId, dto.projectId, dto.workspaceId);
    await this.validatePlanningLinks(dto.projectId, dto.workspaceId, dto);
    // Validate parent task nesting depth (max 2 per ADR-11 / D11)
    if (dto.parentTaskId) {
      const parentTask = await this.taskRepo.findOne({
        where: { id: dto.parentTaskId, projectId: dto.projectId, workspaceId: dto.workspaceId },
      });
      if (!parentTask) throw new NotFoundException('PARENT_TASK_NOT_FOUND');
      if (parentTask.parentTaskId !== null) {
        throw new BadRequestException(
          'MAX_NESTING_EXCEEDED: tasks support max 2 levels of nesting',
        );
      }
    }

    // Validate custom fields
    if (dto.customFields && Object.keys(dto.customFields).length > 0) {
      const errors = await this.customFieldService.validateTaskCustomFields(
        dto.projectId,
        dto.workspaceId,
        dto.customFields,
      );
      if (errors.length > 0) {
        throw new BadRequestException(errors[0].message);
      }
    }

    const rank = this.lexorank.between(null, null);
    const { issueNumber, issueKey } = await this.nextIssueIdentity(dto.projectId, dto.workspaceId);

    const task = this.taskRepo.create({
      workspaceId: dto.workspaceId,
      projectId: dto.projectId,
      statusId: dto.statusId,
      issueNumber,
      issueKey,
      title: dto.title,
      description: dto.description ?? null,
      priority: dto.priority ?? TaskPriority.NONE,
      type: dto.type ?? TaskType.TASK,
      dueDate: dto.dueDate ?? null,
      startDate: dto.startDate ?? null,
      estimatedHours: dto.estimatedHours ?? null,
      parentTaskId: dto.parentTaskId ?? null,
      epicId: dto.epicId ?? null,
      sprintId: dto.sprintId ?? null,
      releaseId: dto.releaseId ?? null,
      rank,
      customFields: dto.customFields ?? {},
    });

    const saved = await this.taskRepo.save(task);

    // Assign users if provided
    if (dto.assigneeUserIds && dto.assigneeUserIds.length > 0) {
      for (const userId of dto.assigneeUserIds) {
        await this.assignmentService.assign(saved.id, userId, dto.actorUserId, dto.projectId, dto.workspaceId);
      }
    }

    // Add labels if provided
    if (dto.labelIds && dto.labelIds.length > 0) {
      for (const labelId of dto.labelIds) {
        await this.labelService.addLabel(saved.id, labelId, dto.actorUserId, dto.projectId, dto.workspaceId);
      }
    }

    this.eventBus.publish(
      new TaskCreatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Task',
        actorUserId: dto.actorUserId,
        workspaceId: dto.workspaceId,
        payload: {
          taskId: saved.id,
          projectId: dto.projectId,
          title: saved.title,
          assigneeUserIds: dto.assigneeUserIds,
        },
      }),
    );

    return saved;
  }

  private async nextIssueIdentity(projectId: string, workspaceId: string): Promise<{ issueNumber: number; issueKey: string }> {
    const project = await this.projectRepo.findOne({ where: { id: projectId, workspaceId } });
    if (!project) throw new NotFoundException('PROJECT_NOT_FOUND');

    const row = await this.taskRepo
      .createQueryBuilder('task')
      .withDeleted()
      .select('COALESCE(MAX(task.issueNumber), 0)', 'max')
      .where('task.projectId = :projectId', { projectId })
      .andWhere('task.workspaceId = :workspaceId', { workspaceId })
      .getRawOne<{ max: string | number }>();

    const issueNumber = Number(row?.max ?? 0) + 1;
    return { issueNumber, issueKey: `${project.key}-${issueNumber}` };
  }
  async update(id: string, dto: UpdateTaskDto, projectId?: string, workspaceId?: string): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({ where: projectId && workspaceId ? { id, projectId, workspaceId } : projectId ? { id, projectId } : workspaceId ? { id, workspaceId } : { id } });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');
    await this.validatePlanningLinks(task.projectId, task.workspaceId, dto);

    // Validate custom fields if provided
    if (dto.customFields && Object.keys(dto.customFields).length > 0) {
      const errors = await this.customFieldService.validateTaskCustomFields(
        task.projectId,
        task.workspaceId,
        dto.customFields,
      );
      if (errors.length > 0) {
        throw new BadRequestException(errors[0].message);
      }
    }

    Object.assign(task, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.dueDate !== undefined && { dueDate: dto.dueDate }),
      ...(dto.startDate !== undefined && { startDate: dto.startDate }),
      ...(dto.estimatedHours !== undefined && {
        estimatedHours: dto.estimatedHours,
      }),
      ...(dto.epicId !== undefined && { epicId: dto.epicId }),
      ...(dto.sprintId !== undefined && { sprintId: dto.sprintId }),
      ...(dto.releaseId !== undefined && { releaseId: dto.releaseId }),
      ...(dto.customFields !== undefined && { customFields: dto.customFields }),
    });

    const saved = await this.taskRepo.save(task);

    this.eventBus.publish(
      new TaskUpdatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Task',
        actorUserId: dto.actorUserId,
        workspaceId: saved.workspaceId,
        payload: {
          taskId: saved.id,
          projectId: saved.projectId,
          changes: { ...dto } as Record<string, unknown>,
        },
      }),
    );

    return saved;
  }

  /**
   * Changes the status of a task.
   * - Always emits TaskStatusChangedEvent.
   * - Emits TaskCompletedEvent when entering DONE category (sets completedAt).
   * - Clears completedAt when leaving DONE category (ADR-12).
   */
  async changeStatus(
    id: string,
    statusId: string,
    actorUserId?: string,
    projectId?: string,
    workspaceId?: string,
  ): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({ where: projectId && workspaceId ? { id, projectId, workspaceId } : projectId ? { id, projectId } : workspaceId ? { id, workspaceId } : { id } });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');

    const newStatus = await this.statusRepo.findOne({
      where: [
        { id: statusId, projectId: task.projectId },
        { id: statusId, workspaceId: task.workspaceId, projectId: IsNull() },
      ],
    });
    if (!newStatus) throw new NotFoundException('STATUS_NOT_FOUND');

    const previousStatusId = task.statusId;
    task.statusId = statusId;

    const enteringDone = newStatus.category === StatusCategory.DONE;
    const leavingDone = !enteringDone && task.completedAt !== null;

    if (enteringDone) {
      task.completedAt = new Date();
    } else if (leavingDone) {
      task.completedAt = null;
    }

    const saved = await this.taskRepo.save(task);

    // Load assignees for notification payload
    const assignments = await this.assignmentService.listAssignees(id);
    const assigneeUserIds = assignments.map((a) => a.userId);

    this.eventBus.publish(
      new TaskStatusChangedEvent({
        aggregateId: saved.id,
        aggregateType: 'Task',
        actorUserId,
        workspaceId: saved.workspaceId,
        payload: {
          taskId: saved.id,
          projectId: saved.projectId,
          previousStatusId,
          newStatusId: statusId,
          newCategory: newStatus.category,
          assigneeUserIds,
        },
      }),
    );

    if (enteringDone) {
      this.eventBus.publish(
        new TaskCompletedEvent({
          aggregateId: saved.id,
          aggregateType: 'Task',
          actorUserId,
          workspaceId: saved.workspaceId,
          payload: {
            taskId: saved.id,
            projectId: saved.projectId,
            completedAt: saved.completedAt!.toISOString(),
            assigneeUserIds,
          },
        }),
      );
    }

    return saved;
  }

  async getById(id: string, projectId?: string, workspaceId?: string): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({
      where: projectId && workspaceId ? { id, projectId, workspaceId } : projectId ? { id, projectId } : workspaceId ? { id, workspaceId } : { id },
      relations: ['subtasks', 'assignments', 'labels'],
    });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');
    return this.withRelationIds(task);
  }

  async list(filter: ListTasksFilter): Promise<TaskEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.projectId) where.projectId = filter.projectId;
    if (filter.statusId) where.statusId = filter.statusId;
    if (filter.priority) where.priority = filter.priority;
    if (filter.type) where.type = filter.type;

    // For simple filters, use find; for complex (date ranges, assignee, labels, q) use QB
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignments', 'assignment')
      .leftJoinAndSelect('task.labels', 'taskLabel')
      .where('task.deleted_at IS NULL');

    if (filter.projectId)
      qb.andWhere('task.project_id = :projectId', {
        projectId: filter.projectId,
      });
    if (filter.workspaceId)
      qb.andWhere('task.workspace_id = :workspaceId', {
        workspaceId: filter.workspaceId,
      });
    if (filter.statusId)
      qb.andWhere('task.status_id = :statusId', { statusId: filter.statusId });
    if (filter.priority)
      qb.andWhere('task.priority = :priority', { priority: filter.priority });
    if (filter.type)
      qb.andWhere('task.type = :type', { type: filter.type });
    if (filter.assigneeUserId)
      qb.andWhere('assignment.user_id = :assigneeUserId', {
        assigneeUserId: filter.assigneeUserId,
      });
    if (filter.labelId)
      qb.andWhere('taskLabel.label_id = :labelId', {
        labelId: filter.labelId,
      });
    if (filter.q) qb.andWhere('task.title ILIKE :q', { q: `%${filter.q}%` });
    if (filter.dueBefore)
      qb.andWhere('task.due_date <= :dueBefore', {
        dueBefore: filter.dueBefore,
      });
    if (filter.dueAfter)
      qb.andWhere('task.due_date >= :dueAfter', { dueAfter: filter.dueAfter });

    const tasks = await qb.distinct(true).orderBy('task.rank', 'ASC').getMany();
    return tasks.map((task) => this.withRelationIds(task));
  }

  async listSubtasks(parentTaskId: string): Promise<TaskEntity[]> {
    return this.taskRepo.find({
      where: { parentTaskId },
      order: { rank: 'ASC' },
    });
  }

  async delete(id: string, actorUserId?: string, projectId?: string, workspaceId?: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: projectId && workspaceId ? { id, projectId, workspaceId } : projectId ? { id, projectId } : workspaceId ? { id, workspaceId } : { id } });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');

    await this.taskRepo.softDelete(id);

    this.eventBus.publish(
      new TaskDeletedEvent({
        aggregateId: id,
        aggregateType: 'Task',
        actorUserId,
        workspaceId: task.workspaceId,
        payload: { taskId: id, projectId: task.projectId },
      }),
    );
  }

  /**
   * Shortcut: marks a task as complete by switching it to the first DONE-category status
   * for the task's project. Called by POST /tasks/:id/complete.
   */
  async complete(id: string, actorUserId?: string, projectId?: string, workspaceId?: string): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({ where: projectId && workspaceId ? { id, projectId, workspaceId } : projectId ? { id, projectId } : workspaceId ? { id, workspaceId } : { id } });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');

    // Find first DONE-category status for this project (or workspace default)
    const doneStatus = await this.statusRepo.findOne({
      where: { projectId: task.projectId, category: StatusCategory.DONE },
    });
    if (!doneStatus) throw new NotFoundException('NO_DONE_STATUS_FOUND');

    return this.changeStatus(id, doneStatus.id, actorUserId, task.projectId, task.workspaceId);
  }

  async reorder(id: string, dto: ReorderTaskDto, projectId?: string, workspaceId?: string): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({ where: projectId && workspaceId ? { id, projectId, workspaceId } : projectId ? { id, projectId } : workspaceId ? { id, workspaceId } : { id } });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');

    const beforeRank = dto.beforeId
      ? ((await this.taskRepo.findOne({ where: { id: dto.beforeId, projectId: task.projectId, workspaceId: task.workspaceId } }))?.rank ??
        null)
      : null;

    const afterRank = dto.afterId
      ? ((await this.taskRepo.findOne({ where: { id: dto.afterId, projectId: task.projectId, workspaceId: task.workspaceId } }))?.rank ??
        null)
      : null;

    const newRank = this.lexorank.between(beforeRank, afterRank);
    task.rank = newRank;

    return this.taskRepo.save(task);
  }

  private async validatePlanningLinks(
    projectId: string,
    workspaceId: string,
    dto: Pick<CreateTaskDto, 'epicId' | 'sprintId' | 'releaseId'>,
  ): Promise<void> {
    const links: Array<[string | null | undefined, PlanningItemType]> = [
      [dto.epicId, 'epic'],
      [dto.sprintId, 'sprint'],
      [dto.releaseId, 'release'],
    ];
    for (const [id, type] of links) {
      if (!id) continue;
      const item = await this.planningRepo.findOne({ where: { id, projectId, workspaceId, type } });
      if (!item) throw new BadRequestException(`INVALID_${type.toUpperCase()}_LINK`);
    }
  }

  private async validateStatusLink(
    statusId: string,
    projectId: string,
    workspaceId: string,
  ): Promise<void> {
    const status = await this.statusRepo.findOne({
      where: [
        { id: statusId, projectId },
        { id: statusId, workspaceId, projectId: IsNull() },
      ],
    });
    if (!status) throw new BadRequestException('INVALID_STATUS_LINK');
  }

  private withRelationIds(task: TaskEntity): TaskEntity {
    task.assigneeUserIds = (task.assignments ?? []).map((assignment) => assignment.userId);
    task.labelIds = (task.labels ?? []).map((label) => label.labelId);
    return task;
  }
}
