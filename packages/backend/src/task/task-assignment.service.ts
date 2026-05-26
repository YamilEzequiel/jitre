import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskAssignmentEntity } from './task-assignment.entity';
import { TaskEntity } from './task.entity';
import { ProjectMembershipEntity } from '../project/project-membership/project-membership.entity';
import { EventBusService } from '../events/event-bus.service';
import { TaskAssignedEvent, TaskUnassignedEvent } from './events';

@Injectable()
export class TaskAssignmentService {
  constructor(
    @InjectRepository(TaskAssignmentEntity)
    private readonly assignmentRepo: Repository<TaskAssignmentEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(ProjectMembershipEntity)
    private readonly membershipRepo: Repository<ProjectMembershipEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Assigns a user to a task. Idempotent: if already assigned, returns existing assignment.
   */
  async assign(
    taskId: string,
    userId: string,
    assignedByUserId?: string,
    projectId?: string,
    workspaceId?: string,
  ): Promise<TaskAssignmentEntity> {
    const task = await this.taskRepo.findOne({
      where: projectId && workspaceId ? { id: taskId, projectId, workspaceId } : projectId ? { id: taskId, projectId } : workspaceId ? { id: taskId, workspaceId } : { id: taskId },
    });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');

    const membership = await this.membershipRepo.findOne({
      where: { projectId: task.projectId, workspaceId: task.workspaceId, userId },
    });
    if (!membership) throw new NotFoundException('PROJECT_MEMBERSHIP_NOT_FOUND');

    // Check idempotent
    const existing = await this.assignmentRepo.findOne({
      where: { taskId, userId, workspaceId: task.workspaceId },
    });
    if (existing) return existing;

    const assignment = this.assignmentRepo.create({
      workspaceId: task.workspaceId,
      taskId,
      userId,
      assignedByUserId: assignedByUserId ?? null,
    });
    const saved = await this.assignmentRepo.save(assignment);

    this.eventBus.publish(
      new TaskAssignedEvent({
        aggregateId: saved.id,
        aggregateType: 'Task',
        actorUserId: assignedByUserId,
        workspaceId: task.workspaceId,
        payload: {
          taskId,
          projectId: task.projectId,
          assigneeUserId: userId,
          assignedByUserId,
        },
      }),
    );

    return saved;
  }

  async unassign(
    taskId: string,
    userId: string,
    actorUserId?: string,
    projectId?: string,
    workspaceId?: string,
  ): Promise<void> {
    const task = await this.taskRepo.findOne({
      where: projectId && workspaceId ? { id: taskId, projectId, workspaceId } : projectId ? { id: taskId, projectId } : workspaceId ? { id: taskId, workspaceId } : { id: taskId },
    });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');

    const assignment = await this.assignmentRepo.findOne({
      where: { taskId, userId, workspaceId: task.workspaceId },
    });
    if (!assignment) throw new NotFoundException('TASK_ASSIGNMENT_NOT_FOUND');

    await this.assignmentRepo.delete({ taskId, userId, workspaceId: task.workspaceId });

    this.eventBus.publish(
      new TaskUnassignedEvent({
        aggregateId: assignment.id,
        aggregateType: 'Task',
        actorUserId,
        workspaceId: assignment.workspaceId,
        payload: {
          taskId,
          projectId: task.projectId,
          assigneeUserId: userId,
        },
      }),
    );
  }

  async listAssignees(taskId: string): Promise<TaskAssignmentEntity[]> {
    return this.assignmentRepo.find({ where: { taskId } });
  }
}
