import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskLabelEntity } from './task-label.entity';
import { TaskEntity } from './task.entity';
import { LabelEntity } from '../project/label/label.entity';
import { EventBusService } from '../events/event-bus.service';
import { TaskLabelAddedEvent, TaskLabelRemovedEvent } from './events';
import { LabelScope } from '@jitre/shared';

@Injectable()
export class TaskLabelService {
  constructor(
    @InjectRepository(TaskLabelEntity)
    private readonly taskLabelRepo: Repository<TaskLabelEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(LabelEntity)
    private readonly labelRepo: Repository<LabelEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Adds a label to a task.
   * - WORKSPACE scope: always valid.
   * - PROJECT scope: label.projectId must match task.projectId.
   */
  async addLabel(
    taskId: string,
    labelId: string,
    actorUserId?: string,
    projectId?: string,
    workspaceId?: string,
  ): Promise<TaskLabelEntity> {
    const task = await this.taskRepo.findOne({
      where: projectId && workspaceId ? { id: taskId, projectId, workspaceId } : projectId ? { id: taskId, projectId } : workspaceId ? { id: taskId, workspaceId } : { id: taskId },
    });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');

    const label = await this.labelRepo.findOne({
      where: { id: labelId, workspaceId: task.workspaceId },
    });
    if (!label) throw new NotFoundException('LABEL_NOT_FOUND');

    if (
      label.scope === LabelScope.PROJECT &&
      label.projectId !== task.projectId
    ) {
      throw new BadRequestException(
        'LABEL_SCOPE_MISMATCH: PROJECT-scoped label must belong to the same project',
      );
    }

    // Idempotent: if already added, return existing
    const existing = await this.taskLabelRepo.findOne({
      where: { taskId, labelId },
    });
    if (existing) return existing;

    const taskLabel = this.taskLabelRepo.create({
      workspaceId: task.workspaceId,
      taskId,
      labelId,
    });
    const saved = await this.taskLabelRepo.save(taskLabel);

    this.eventBus.publish(
      new TaskLabelAddedEvent({
        aggregateId: saved.id,
        aggregateType: 'Task',
        actorUserId,
        workspaceId: task.workspaceId,
        payload: { taskId, projectId: task.projectId, labelId },
      }),
    );

    return saved;
  }

  async removeLabel(
    taskId: string,
    labelId: string,
    actorUserId?: string,
    projectId?: string,
    workspaceId?: string,
  ): Promise<void> {
    const task = await this.taskRepo.findOne({
      where: projectId && workspaceId ? { id: taskId, projectId, workspaceId } : projectId ? { id: taskId, projectId } : workspaceId ? { id: taskId, workspaceId } : { id: taskId },
    });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');

    const taskLabel = await this.taskLabelRepo.findOne({
      where: { taskId, labelId, workspaceId: task.workspaceId },
    });
    if (!taskLabel) throw new NotFoundException('TASK_LABEL_NOT_FOUND');

    await this.taskLabelRepo.delete({ taskId, labelId, workspaceId: task.workspaceId });

    this.eventBus.publish(
      new TaskLabelRemovedEvent({
        aggregateId: taskLabel.id,
        aggregateType: 'Task',
        actorUserId,
        workspaceId: taskLabel.workspaceId,
        payload: {
          taskId,
          projectId: task.projectId,
          labelId,
        },
      }),
    );
  }
}
