import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, IsNull } from 'typeorm';
import { ProjectEntity } from './project.entity';
import { TaskEntity } from '../task/task.entity';
import { ProjectMembershipService } from './project-membership/project-membership.service';
import { StatusService } from './status/status.service';
import { EventBusService } from '../events/event-bus.service';
import { ChatService } from '../chat/chat.service';
import {
  ProjectCreatedEvent,
  ProjectUpdatedEvent,
  ProjectArchivedEvent,
  ProjectDeletedEvent,
} from './events';
import { ProjectRole, ProjectStatus } from '@jitre/shared';

export interface CreateProjectDto {
  workspaceId: string;
  name: string;
  key: string;
  description?: string | null;
  ownerUserId: string;
  color?: string | null;
  icon?: string | null;
  startDate?: Date | null;
  targetDate?: Date | null;
  category?: string | null;
  framework?: string | null;
  database?: string | null;
  customerName?: string | null;
  repositoryUrl?: string | null;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  startDate?: Date | null;
  targetDate?: Date | null;
  category?: string | null;
  framework?: string | null;
  database?: string | null;
  customerName?: string | null;
  repositoryUrl?: string | null;
  actorUserId?: string;
}

export interface ArchiveProjectDto {
  actorUserId?: string;
}

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    private readonly membershipService: ProjectMembershipService,
    private readonly statusService: StatusService,
    private readonly chatService: ChatService,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Creates a project within a single DB transaction:
   * 1. Insert Project
   * 2. Add owner as ADMIN member
   * 3. Seed 4 default statuses
   * Emits ProjectCreatedEvent + ProjectMemberAddedEvent (via membershipService).
   */
  async create(dto: CreateProjectDto): Promise<ProjectEntity> {
    let savedProject: ProjectEntity;

    await this.dataSource.transaction(async (em: EntityManager) => {
      const project = em.create(ProjectEntity, {
        workspaceId: dto.workspaceId,
        name: dto.name,
        key: dto.key.toUpperCase(),
        description: dto.description ?? null,
        status: ProjectStatus.ACTIVE,
        ownerUserId: dto.ownerUserId,
        color: dto.color ?? null,
        icon: dto.icon ?? null,
        startDate: dto.startDate ?? null,
        targetDate: dto.targetDate ?? null,
        category: dto.category ?? null,
        framework: dto.framework ?? null,
        database: dto.database ?? null,
        customerName: dto.customerName ?? null,
        repositoryUrl: dto.repositoryUrl ?? null,
      });
      savedProject = await em.save(ProjectEntity, project);
    });

    // Add owner as ADMIN (outside transaction for simplicity; event emitted by membership service)
    await this.membershipService.addMember(
      savedProject!.id,
      dto.workspaceId,
      dto.ownerUserId,
      ProjectRole.ADMIN,
      dto.ownerUserId,
    );

    // Seed default statuses
    await this.statusService.ensureDefaults(savedProject!.id, dto.workspaceId);

    await this.chatService.ensureProjectChannel({
      workspaceId: dto.workspaceId,
      projectId: savedProject!.id,
      projectName: savedProject!.name,
      actorUserId: dto.ownerUserId,
      memberUserIds: [dto.ownerUserId],
    });

    this.eventBus.publish(
      new ProjectCreatedEvent({
        aggregateId: savedProject!.id,
        aggregateType: 'Project',
        actorUserId: dto.ownerUserId,
        workspaceId: dto.workspaceId,
        payload: {
          projectId: savedProject!.id,
          name: savedProject!.name,
          key: savedProject!.key,
          ownerUserId: dto.ownerUserId,
        },
      }),
    );

    return savedProject!;
  }

  async update(id: string, workspaceId: string, dto: UpdateProjectDto): Promise<ProjectEntity> {
    const project = await this.projectRepo.findOne({ where: { id, workspaceId } });
    if (!project) throw new NotFoundException('PROJECT_NOT_FOUND');

    Object.assign(project, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.startDate !== undefined && { startDate: dto.startDate }),
      ...(dto.targetDate !== undefined && { targetDate: dto.targetDate }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.framework !== undefined && { framework: dto.framework }),
      ...(dto.database !== undefined && { database: dto.database }),
      ...(dto.customerName !== undefined && { customerName: dto.customerName }),
      ...(dto.repositoryUrl !== undefined && { repositoryUrl: dto.repositoryUrl }),
    });

    const saved = await this.projectRepo.save(project);

    this.eventBus.publish(
      new ProjectUpdatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Project',
        actorUserId: dto.actorUserId,
        workspaceId: saved.workspaceId,
        payload: {
          projectId: saved.id,
          changes: { ...dto } as Record<string, unknown>,
        },
      }),
    );

    return saved;
  }

  /**
   * Archives a project. Per ADR-9: throws 409 if any non-deleted tasks exist.
   */
  async archive(id: string, workspaceId: string, dto: ArchiveProjectDto): Promise<ProjectEntity> {
    const project = await this.projectRepo.findOne({ where: { id, workspaceId } });
    if (!project) throw new NotFoundException('PROJECT_NOT_FOUND');

    const activeTaskCount = await this.taskRepo.count({
      where: { projectId: id, workspaceId, deletedAt: IsNull() },
    });

    if (activeTaskCount > 0) {
      throw new ConflictException(
        'PROJECT_HAS_ACTIVE_TASKS: archive all tasks before archiving the project',
      );
    }

    project.status = ProjectStatus.ARCHIVED;
    const saved = await this.projectRepo.save(project);

    this.eventBus.publish(
      new ProjectArchivedEvent({
        aggregateId: saved.id,
        aggregateType: 'Project',
        actorUserId: dto.actorUserId,
        workspaceId: saved.workspaceId,
        payload: { projectId: saved.id },
      }),
    );

    return saved;
  }

  async getById(id: string, workspaceId: string): Promise<ProjectEntity> {
    const project = await this.projectRepo.findOne({ where: { id, workspaceId } });
    if (!project) throw new NotFoundException('PROJECT_NOT_FOUND');
    return project;
  }

  async list(workspaceId: string): Promise<ProjectEntity[]> {
    return this.projectRepo.find({
      where: { workspaceId },
      order: { name: 'ASC' },
    });
  }

  async delete(id: string, workspaceId: string, actorUserId?: string): Promise<void> {
    const project = await this.projectRepo.findOne({ where: { id, workspaceId } });
    if (!project) throw new NotFoundException('PROJECT_NOT_FOUND');

    // Hard delete — tasks must be gone first (same constraint as archive)
    const activeTaskCount = await this.taskRepo.count({
      where: { projectId: id, workspaceId, deletedAt: IsNull() },
    });
    if (activeTaskCount > 0) {
      throw new ConflictException('PROJECT_HAS_ACTIVE_TASKS');
    }

    await this.projectRepo.softDelete(id);

    this.eventBus.publish(
      new ProjectDeletedEvent({
        aggregateId: id,
        aggregateType: 'Project',
        actorUserId,
        workspaceId: project.workspaceId,
        payload: { projectId: id },
      }),
    );
  }
}
