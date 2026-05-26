import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { QUEUES, JOB_NAMES } from '../jobs/queues.constants';
import { TaskLabelEntity } from '../task/task-label.entity';

interface DomainPayloadEvent<P> {
  workspaceId: string;
  payload: P;
}

interface WorkspaceEvent {
  workspaceId: string;
}

interface UserProfileEvent {
  userId: string;
  workspaceId: string;
}

interface CommentPayload {
  commentId: string;
}

interface TaskPayload {
  taskId: string;
  projectId: string;
  [key: string]: unknown;
}

interface ProjectPayload {
  projectId: string;
  [key: string]: unknown;
}

interface LabelPayload {
  labelId: string;
  changes: Record<string, unknown>;
}

interface DocumentPayload {
  documentId: string;
  cascadedChildIds?: string[];
  [key: string]: unknown;
}

/**
 * Listens to domain events and enqueues index-entity jobs so the
 * IndexEntityProcessor can update the search index asynchronously.
 * Extended in Fase 6 to handle Task + Project + label fan-out.
 */
@Injectable()
export class IndexerListener {
  constructor(
    @InjectQueue(QUEUES.SEARCH_INDEXER) private readonly queue: Queue,
    @InjectRepository(TaskLabelEntity)
    private readonly taskLabelRepo: Repository<TaskLabelEntity>,
  ) {}

  // --- Comment handlers (Fase 5) ---

  @OnEvent('comment.created')
  async onCommentCreated(
    event: DomainPayloadEvent<CommentPayload>,
  ): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'comment',
      entityId: event.payload.commentId,
      action: 'upsert',
    });
  }

  @OnEvent('comment.updated')
  async onCommentUpdated(
    event: DomainPayloadEvent<CommentPayload>,
  ): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'comment',
      entityId: event.payload.commentId,
      action: 'upsert',
    });
  }

  @OnEvent('comment.deleted')
  async onCommentDeleted(
    event: DomainPayloadEvent<CommentPayload>,
  ): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'comment',
      entityId: event.payload.commentId,
      action: 'delete',
    });
  }

  @OnEvent('workspace.created')
  @OnEvent('workspace.updated')
  async onWorkspaceCreated(event: WorkspaceEvent): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'workspace',
      entityId: event.workspaceId,
      action: 'upsert',
    });
  }

  @OnEvent('user.profile.updated')
  async onUserProfileUpdated(event: UserProfileEvent): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'user',
      entityId: event.userId,
      action: 'upsert',
    });
  }

  // --- Task handlers (Fase 6) ---

  @OnEvent('task.created')
  async onTaskCreated(event: DomainPayloadEvent<TaskPayload>): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'task',
      entityId: event.payload.taskId,
      action: 'upsert',
    });
  }

  @OnEvent('task.updated')
  @OnEvent('task.status_changed')
  async onTaskUpdated(event: DomainPayloadEvent<TaskPayload>): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'task',
      entityId: event.payload.taskId,
      action: 'upsert',
    });
  }

  @OnEvent('task.deleted')
  async onTaskDeleted(event: DomainPayloadEvent<TaskPayload>): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'task',
      entityId: event.payload.taskId,
      action: 'delete',
    });
  }

  // --- Project handlers (Fase 6) ---

  @OnEvent('project.created')
  async onProjectCreated(
    event: DomainPayloadEvent<ProjectPayload>,
  ): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'project',
      entityId: event.payload.projectId,
      action: 'upsert',
    });
  }

  @OnEvent('project.updated')
  async onProjectUpdated(
    event: DomainPayloadEvent<ProjectPayload>,
  ): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'project',
      entityId: event.payload.projectId,
      action: 'upsert',
    });
  }

  @OnEvent('project.archived')
  @OnEvent('project.deleted')
  async onProjectArchived(
    event: DomainPayloadEvent<ProjectPayload>,
  ): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'project',
      entityId: event.payload.projectId,
      action: 'delete',
    });
  }

  /**
   * label.updated fan-out: re-index every task that carries the updated label.
   * ADR-D14: acceptable cost at workspace scale.
   */
  @OnEvent('label.updated')
  async onLabelUpdated(event: DomainPayloadEvent<LabelPayload>): Promise<void> {
    const taskLabels = await this.taskLabelRepo.find({
      where: { labelId: event.payload.labelId },
    });

    for (const tl of taskLabels) {
      await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
        workspaceId: tl.workspaceId,
        entityType: 'task',
        entityId: tl.taskId,
        action: 'upsert',
      });
    }
  }

  // --- Document handlers ---

  @OnEvent('document.created')
  @OnEvent('document.updated')
  async onDocumentUpsert(
    event: DomainPayloadEvent<DocumentPayload>,
  ): Promise<void> {
    await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: event.workspaceId,
      entityType: 'document',
      entityId: event.payload.documentId,
      action: 'upsert',
    });
  }

  @OnEvent('document.deleted')
  async onDocumentDeleted(
    event: DomainPayloadEvent<DocumentPayload>,
  ): Promise<void> {
    const ids = [
      event.payload.documentId,
      ...(event.payload.cascadedChildIds ?? []),
    ];

    for (const documentId of ids) {
      await this.queue.add(JOB_NAMES.ENTITY_INDEX, {
        workspaceId: event.workspaceId,
        entityType: 'document',
        entityId: documentId,
        action: 'delete',
      });
    }
  }
}
