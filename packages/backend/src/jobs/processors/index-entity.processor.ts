import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { QUEUES } from '../queues.constants';
import { SearchEntityType } from '../../search/search-document.entity';
import { Comment } from '../../comment/comment.entity';
import { WorkspaceEntity } from '../../workspace/workspace.entity';
import { UserEntity } from '../../user/user.entity';
import { TaskEntity } from '../../task/task.entity';
import { ProjectEntity } from '../../project/project.entity';
import { TaskLabelEntity } from '../../task/task-label.entity';
import { DocumentEntity } from '../../document/document.entity';
import { SearchService } from '../../search/search.service';

export interface IndexEntityJobPayload {
  workspaceId: string;
  entityType: SearchEntityType;
  entityId: string;
  action: 'upsert' | 'delete';
}

@Injectable()
@Processor(QUEUES.SEARCH_INDEXER)
export class IndexEntityProcessor extends WorkerHost {
  private readonly logger = new Logger(IndexEntityProcessor.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(DocumentEntity)
    private readonly documentRepo: Repository<DocumentEntity>,
    @InjectRepository(TaskLabelEntity)
    private readonly taskLabelRepo: Repository<TaskLabelEntity>,
    private readonly searchService: SearchService,
  ) {
    super();
  }

  async process(
    job: Job<IndexEntityJobPayload>,
  ): Promise<{ skipped: string } | undefined> {
    const { workspaceId, entityType, entityId, action } = job.data;

    if (action === 'delete') {
      await this.searchService.delete(workspaceId, entityType, entityId);
      this.logger.log(`Soft-deleted search doc: ${entityType}/${entityId}`);
      return;
    }

    // action === 'upsert'
    const entity = await this.loadEntity(entityType, entityId);
    if (!entity) {
      this.logger.log(
        `Entity missing: ${entityType}/${entityId} — treating as delete`,
      );
      return { skipped: 'entity_missing' };
    }

    const content = await this.buildContentAsync(entityType, entityId, entity);

    await this.searchService.upsert({
      workspaceId,
      entityType,
      entityId,
      content,
      occurredAt: new Date(),
    });

    this.logger.log(`Upserted search doc: ${entityType}/${entityId}`);
    return;
  }

  private async loadEntity(
    entityType: SearchEntityType,
    entityId: string,
  ): Promise<Record<string, unknown> | null> {
    switch (entityType) {
      case 'comment':
        return this.commentRepo.findOne({
          where: { id: entityId },
        }) as Promise<Record<string, unknown> | null>;
      case 'workspace':
        return this.workspaceRepo.findOne({
          where: { id: entityId },
        }) as Promise<Record<string, unknown> | null>;
      case 'user':
        return this.userRepo.findOne({
          where: { id: entityId },
        }) as Promise<Record<string, unknown> | null>;
      case 'task':
        return this.taskRepo.findOne({
          where: { id: entityId },
        }) as Promise<Record<string, unknown> | null>;
      case 'project':
        return this.projectRepo.findOne({
          where: { id: entityId },
        }) as Promise<Record<string, unknown> | null>;
      case 'document':
        return this.documentRepo.findOne({
          where: { id: entityId },
        }) as Promise<Record<string, unknown> | null>;
    }
  }

  /**
   * Async version of buildContent that can load task labels for denormalization.
   */
  private async buildContentAsync(
    entityType: SearchEntityType,
    entityId: string,
    entity: Record<string, unknown>,
  ): Promise<string> {
    if (entityType === 'task') {
      // Denormalize label names for full-text search (ADR-D14)
      const taskLabels = await this.taskLabelRepo.find({
        where: { taskId: entityId },
      });
      const labelNames = (
        taskLabels as Array<{ label?: { name: string } | null }>
      )
        .map((tl) => tl.label?.name ?? '')
        .filter(Boolean);

      return this.buildContent('task', { ...entity, labelNames });
    }

    return this.buildContent(entityType, entity);
  }

  buildContent(
    entityType: SearchEntityType,
    entity: Record<string, unknown>,
  ): string {
    switch (entityType) {
      case 'comment':
        return (entity.body as string | null | undefined) ?? '';
      case 'workspace':
        return [entity.name, entity.slug, entity.description ?? ''].join(' ');
      case 'user':
        return [
          entity.email,
          entity.displayName ?? '',
          entity.username ?? '',
        ].join(' ');
      case 'task': {
        const labelNames = (entity.labelNames as string[] | undefined) ?? [];
        return [entity.title, entity.description ?? '', ...labelNames]
          .join(' ')
          .trim();
      }
      case 'project':
        return [entity.name, entity.key, entity.description ?? ''].join(' ');
      case 'document':
        return [entity.title, entity.contentText ?? ''].join(' ').trim();
    }
  }
}
