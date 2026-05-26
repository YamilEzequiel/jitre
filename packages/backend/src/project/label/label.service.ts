import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabelEntity } from './label.entity';
import { TaskLabelEntity } from '../../task/task-label.entity';
import { EventBusService } from '../../events/event-bus.service';
import {
  LabelCreatedEvent,
  LabelUpdatedEvent,
  LabelDeletedEvent,
} from '../events';
import { LabelScope } from '@jitre/shared';

export interface CreateLabelDto {
  workspaceId: string;
  projectId?: string | null;
  name: string;
  scope: LabelScope;
  color?: string | null;
  actorUserId?: string;
}

export interface UpdateLabelDto {
  name?: string;
  color?: string | null;
  actorUserId?: string;
}

export interface DeleteLabelDto {
  actorUserId?: string;
}

@Injectable()
export class LabelService {
  constructor(
    @InjectRepository(LabelEntity)
    private readonly labelRepo: Repository<LabelEntity>,
    @InjectRepository(TaskLabelEntity)
    private readonly taskLabelRepo: Repository<TaskLabelEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateLabelDto): Promise<LabelEntity> {
    // Scope/projectId invariant
    if (dto.scope === LabelScope.WORKSPACE && dto.projectId != null) {
      throw new BadRequestException('WORKSPACE_LABEL_CANNOT_HAVE_PROJECT_ID');
    }
    if (dto.scope === LabelScope.PROJECT && dto.projectId == null) {
      throw new BadRequestException('PROJECT_LABEL_REQUIRES_PROJECT_ID');
    }

    const label = this.labelRepo.create({
      workspaceId: dto.workspaceId,
      projectId: dto.projectId ?? null,
      name: dto.name,
      scope: dto.scope,
      color: dto.color ?? null,
    });
    const saved = await this.labelRepo.save(label);

    this.eventBus.publish(
      new LabelCreatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Label',
        actorUserId: dto.actorUserId,
        workspaceId: dto.workspaceId,
        payload: {
          labelId: saved.id,
          name: saved.name,
          scope: saved.scope,
          projectId: saved.projectId,
        },
      }),
    );

    return saved;
  }

  async update(id: string, workspaceId: string, dto: UpdateLabelDto): Promise<LabelEntity> {
    const label = await this.labelRepo.findOne({ where: { id, workspaceId } });
    if (!label) throw new NotFoundException('LABEL_NOT_FOUND');

    const prevName = label.name;
    Object.assign(label, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.color !== undefined && { color: dto.color }),
    });

    const saved = await this.labelRepo.save(label);

    this.eventBus.publish(
      new LabelUpdatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Label',
        actorUserId: dto.actorUserId,
        workspaceId: saved.workspaceId,
        payload: {
          labelId: saved.id,
          changes: { ...dto } as Record<string, unknown>,
          nameChanged: dto.name !== undefined && dto.name !== prevName,
        },
      }),
    );

    return saved;
  }

  /**
   * Deletes a label. Cascades TaskLabel join rows first (design §5 / F3 spec).
   * TaskLabel rows reference labelId; removing them prevents FK violation.
   */
  async delete(id: string, workspaceId: string, dto: DeleteLabelDto): Promise<void> {
    const label = await this.labelRepo.findOne({ where: { id, workspaceId } });
    if (!label) throw new NotFoundException('LABEL_NOT_FOUND');

    // Cascade: remove all task-label associations
    await this.taskLabelRepo.delete({ labelId: id, workspaceId });
    await this.labelRepo.delete(id);

    this.eventBus.publish(
      new LabelDeletedEvent({
        aggregateId: id,
        aggregateType: 'Label',
        actorUserId: dto.actorUserId,
        workspaceId: label.workspaceId,
        payload: { labelId: id, projectId: label.projectId },
      }),
    );
  }

  async listByWorkspace(workspaceId: string): Promise<LabelEntity[]> {
    return this.labelRepo.find({
      where: { workspaceId, scope: LabelScope.WORKSPACE },
      order: { name: 'ASC' },
    });
  }

  async listByProject(projectId: string, workspaceId: string): Promise<LabelEntity[]> {
    return this.labelRepo.find({
      where: { projectId, workspaceId, scope: LabelScope.PROJECT },
      order: { name: 'ASC' },
    });
  }
}
