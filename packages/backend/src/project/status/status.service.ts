import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, IsNull } from 'typeorm';
import { StatusEntity } from './status.entity';
import { TaskEntity } from '../../task/task.entity';
import { EventBusService } from '../../events/event-bus.service';
import {
  StatusCreatedEvent,
  StatusUpdatedEvent,
  StatusDeletedEvent,
} from '../events';
import { StatusCategory } from '@jitre/shared';

export interface CreateStatusDto {
  workspaceId: string;
  projectId?: string | null;
  name: string;
  category: StatusCategory;
  isDefault?: boolean;
  order?: number;
  color?: string | null;
  actorUserId?: string;
}

export interface UpdateStatusDto {
  name?: string;
  category?: StatusCategory;
  isDefault?: boolean;
  order?: number;
  color?: string | null;
  actorUserId?: string;
}

export interface DeleteStatusDto {
  replaceWithStatusId?: string;
  actorUserId?: string;
}

/** Default workspace statuses seeded on project create (design §5 / ADR-5). */
const DEFAULT_STATUSES: Array<{
  name: string;
  category: StatusCategory;
  isDefault: boolean;
  order: number;
}> = [
  { name: 'To Do', category: StatusCategory.TODO, isDefault: true, order: 0 },
  {
    name: 'In Progress',
    category: StatusCategory.IN_PROGRESS,
    isDefault: false,
    order: 1,
  },
  {
    name: 'Review',
    category: StatusCategory.IN_PROGRESS,
    isDefault: false,
    order: 2,
  },
  { name: 'Done', category: StatusCategory.DONE, isDefault: false, order: 3 },
];

@Injectable()
export class StatusService {
  constructor(
    @InjectRepository(StatusEntity)
    private readonly statusRepo: Repository<StatusEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Seeds 4 default statuses for a new project within a transaction.
   * Called by ProjectService.create (ADR-5).
   */
  async ensureDefaults(
    projectId: string,
    workspaceId: string,
  ): Promise<StatusEntity[]> {
    return this.dataSource.transaction(async (em: EntityManager) => {
      const results: StatusEntity[] = [];
      for (const def of DEFAULT_STATUSES) {
        const status = em.create(StatusEntity, {
          workspaceId,
          projectId,
          name: def.name,
          category: def.category,
          isDefault: def.isDefault,
          order: def.order,
        });
        const saved = await em.save(StatusEntity, status);
        results.push(saved);
      }
      return results;
    });
  }

  async create(dto: CreateStatusDto): Promise<StatusEntity> {
    const status = this.statusRepo.create({
      workspaceId: dto.workspaceId,
      projectId: dto.projectId ?? null,
      name: dto.name,
      category: dto.category,
      isDefault: dto.isDefault ?? false,
      order: dto.order ?? 0,
      color: dto.color ?? null,
    });
    const saved = await this.statusRepo.save(status);

    this.eventBus.publish(
      new StatusCreatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Status',
        actorUserId: dto.actorUserId,
        workspaceId: dto.workspaceId,
        payload: {
          statusId: saved.id,
          projectId: saved.projectId,
          name: saved.name,
          category: saved.category,
        },
      }),
    );

    return saved;
  }

  async update(id: string, workspaceId: string, dto: UpdateStatusDto): Promise<StatusEntity> {
    const status = await this.statusRepo.findOne({ where: { id, workspaceId } });
    if (!status) throw new NotFoundException('STATUS_NOT_FOUND');

    Object.assign(status, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      ...(dto.order !== undefined && { order: dto.order }),
      ...(dto.color !== undefined && { color: dto.color }),
    });

    const saved = await this.statusRepo.save(status);

    this.eventBus.publish(
      new StatusUpdatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Status',
        actorUserId: dto.actorUserId,
        workspaceId: saved.workspaceId,
        payload: {
          statusId: saved.id,
          projectId: saved.projectId,
          changes: { ...dto } as Record<string, unknown>,
        },
      }),
    );

    return saved;
  }

  /**
   * Deletes a status. Per ADR-8:
   * - If tasks reference this status and no replaceWithStatusId → 400
   * - If tasks reference this status and replaceWithStatusId provided → move tasks first
   */
  async delete(id: string, workspaceId: string, dto: DeleteStatusDto): Promise<void> {
    const status = await this.statusRepo.findOne({ where: { id, workspaceId } });
    if (!status) throw new NotFoundException('STATUS_NOT_FOUND');

    const taskCount = await this.taskRepo.count({ where: { statusId: id, workspaceId } });

    if (taskCount > 0) {
      if (!dto.replaceWithStatusId) {
        throw new BadRequestException(
          'REPLACE_STATUS_REQUIRED: tasks reference this status; provide replaceWithStatusId',
        );
      }
      // Move all referencing tasks to the replacement status
      const replacement = await this.statusRepo.findOne({
        where: { id: dto.replaceWithStatusId, workspaceId },
      });
      if (!replacement) throw new NotFoundException('REPLACEMENT_STATUS_NOT_FOUND');
      if (
        replacement.projectId !== null &&
        replacement.projectId !== status.projectId
      ) {
        throw new BadRequestException('REPLACEMENT_STATUS_PROJECT_MISMATCH');
      }
      await this.taskRepo.update(
        { statusId: id, workspaceId },
        { statusId: dto.replaceWithStatusId },
      );
    }

    await this.statusRepo.delete(id);

    this.eventBus.publish(
      new StatusDeletedEvent({
        aggregateId: id,
        aggregateType: 'Status',
        actorUserId: dto.actorUserId,
        workspaceId: status.workspaceId,
        payload: { statusId: id, projectId: status.projectId },
      }),
    );
  }

  /**
   * Returns project-specific statuses. Falls back to workspace defaults (projectId IS NULL)
   * when no project-specific statuses exist (ADR-5).
   */
  async listByProject(
    projectId: string,
    workspaceId?: string,
  ): Promise<StatusEntity[]> {
    const projectStatuses = await this.statusRepo.find({
      where: { projectId, ...(workspaceId && { workspaceId }) },
      order: { order: 'ASC' },
    });

    if (projectStatuses.length > 0) return projectStatuses;

    // Fallback to workspace defaults
    if (!workspaceId) return [];
    return this.statusRepo.find({
      where: { workspaceId, projectId: IsNull() },
      order: { order: 'ASC' },
    });
  }

  /** Returns all workspace-catalog statuses (projectId IS NULL). */
  async listByWorkspace(workspaceId: string): Promise<StatusEntity[]> {
    return this.statusRepo.find({
      where: { workspaceId, projectId: IsNull() },
      order: { order: 'ASC' },
    });
  }
}
