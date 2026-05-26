import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { DocumentEntity } from './document.entity';
import { EventBusService } from '../events/event-bus.service';
import {
  DocumentCreatedEvent,
  DocumentUpdatedEvent,
  DocumentDeletedEvent,
} from './events';

export interface CreateDocumentInput {
  workspaceId: string;
  actorUserId: string;
  title: string;
  projectId?: string | null;
  parentId?: string | null;
  content?: Record<string, unknown>;
  icon?: string | null;
  order?: number;
}

export interface UpdateDocumentInput {
  id: string;
  workspaceId: string;
  actorUserId: string;
  title?: string;
  content?: Record<string, unknown>;
  icon?: string | null;
  order?: number;
}

export interface MoveDocumentInput {
  id: string;
  workspaceId: string;
  actorUserId: string;
  parentId?: string | null;
  order?: number;
}

export interface ListDocumentsInput {
  workspaceId: string;
  projectId?: string;
  /** undefined → no filter, null → roots only, string → that parent's children */
  parentId?: string | null;
  q?: string;
}

export interface DocumentTreeNode {
  document: DocumentEntity;
  children: DocumentTreeNode[];
}

/**
 * Extract plain text from a Quill Delta-shaped JSON object.
 *
 * Expected shape: `{ ops: [{ insert: '...' | { ... } }, ...] }`. Only string
 * inserts contribute to the output; embeds (image, video, …) are skipped.
 * Falls back to an empty string for empty / malformed content.
 */
export function extractPlainText(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const ops = (content as { ops?: unknown }).ops;
  if (!Array.isArray(ops)) return '';

  const parts: string[] = [];
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    const insert = (op as { insert?: unknown }).insert;
    if (typeof insert === 'string') {
      parts.push(insert);
    }
  }
  return parts.join('');
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly docRepo: Repository<DocumentEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  async create(input: CreateDocumentInput): Promise<DocumentEntity> {
    const {
      workspaceId,
      actorUserId,
      title,
      projectId,
      parentId,
      content,
      icon,
      order,
    } = input;

    if (parentId) {
      const parent = await this.docRepo.findOne({
        where: { id: parentId, workspaceId },
      });
      if (!parent) {
        throw new NotFoundException('PARENT_DOCUMENT_NOT_FOUND');
      }
      // Children must inherit the parent's project scope, otherwise the tree
      // would mix scopes and break access checks.
      if ((parent.projectId ?? null) !== (projectId ?? null)) {
        throw new BadRequestException('PARENT_PROJECT_MISMATCH');
      }
    }

    const safeContent = content ?? {};
    const contentText = extractPlainText(safeContent);
    const now = new Date();

    const entity = this.docRepo.create({
      workspaceId,
      projectId: projectId ?? null,
      parentId: parentId ?? null,
      title,
      icon: icon ?? null,
      content: safeContent,
      contentText,
      order: order ?? 0,
      creatorUserId: actorUserId,
      lastEditedByUserId: actorUserId,
      lastEditedAt: now,
    });

    const saved = await this.docRepo.save(entity);

    this.eventBus.publish(
      new DocumentCreatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Document',
        workspaceId,
        actorUserId,
        payload: {
          documentId: saved.id,
          projectId: saved.projectId,
          parentId: saved.parentId,
          title: saved.title,
          creatorUserId: actorUserId,
        },
      }),
    );

    return saved;
  }

  async findOne(id: string, workspaceId: string): Promise<DocumentEntity> {
    const doc = await this.docRepo.findOne({ where: { id, workspaceId } });
    if (!doc) {
      throw new NotFoundException('DOCUMENT_NOT_FOUND');
    }
    return doc;
  }

  async update(input: UpdateDocumentInput): Promise<DocumentEntity> {
    const { id, workspaceId, actorUserId, title, content, icon, order } = input;

    const doc = await this.findOne(id, workspaceId);
    const changes: Record<string, unknown> = {};

    if (title !== undefined && title !== doc.title) {
      changes.title = { from: doc.title, to: title };
      doc.title = title;
    }
    if (content !== undefined) {
      doc.content = content;
      doc.contentText = extractPlainText(content);
      changes.content = true;
    }
    if (icon !== undefined && icon !== doc.icon) {
      changes.icon = { from: doc.icon, to: icon };
      doc.icon = icon;
    }
    if (order !== undefined && order !== doc.order) {
      changes.order = { from: doc.order, to: order };
      doc.order = order;
    }

    doc.lastEditedByUserId = actorUserId;
    doc.lastEditedAt = new Date();

    const saved = await this.docRepo.save(doc);

    if (Object.keys(changes).length > 0) {
      this.eventBus.publish(
        new DocumentUpdatedEvent({
          aggregateId: saved.id,
          aggregateType: 'Document',
          workspaceId,
          actorUserId,
          payload: {
            documentId: saved.id,
            projectId: saved.projectId,
            changes,
            lastEditedByUserId: actorUserId,
          },
        }),
      );
    }

    return saved;
  }

  /**
   * Move a document inside the tree.
   *
   * Behaviour:
   * - `parentId === null` (explicit) → move to root.
   * - `parentId === undefined` → keep current parent.
   * - `order` updates the sibling ordering when present.
   *
   * Cycle prevention: walks the new parent's ancestry; if `id` shows up in the
   * chain, the move is rejected with `CYCLE_DETECTED`.
   */
  async move(input: MoveDocumentInput): Promise<DocumentEntity> {
    const { id, workspaceId, actorUserId, parentId, order } = input;

    const doc = await this.findOne(id, workspaceId);

    if (parentId !== undefined) {
      if (parentId === id) {
        throw new BadRequestException('CYCLE_DETECTED');
      }

      if (parentId !== null) {
        const parent = await this.docRepo.findOne({
          where: { id: parentId, workspaceId },
        });
        if (!parent) {
          throw new NotFoundException('PARENT_DOCUMENT_NOT_FOUND');
        }
        if ((parent.projectId ?? null) !== (doc.projectId ?? null)) {
          throw new BadRequestException('PARENT_PROJECT_MISMATCH');
        }
        // Walk up the ancestry — abort if doc.id reappears.
        let cursor: DocumentEntity | null = parent;
        const seen = new Set<string>();
        while (cursor) {
          if (cursor.id === id) {
            throw new BadRequestException('CYCLE_DETECTED');
          }
          if (seen.has(cursor.id) || !cursor.parentId) break;
          seen.add(cursor.id);
          cursor = await this.docRepo.findOne({
            where: { id: cursor.parentId, workspaceId },
          });
        }
      }

      doc.parentId = parentId;
    }

    if (order !== undefined) {
      doc.order = order;
    }

    doc.lastEditedByUserId = actorUserId;
    doc.lastEditedAt = new Date();

    const saved = await this.docRepo.save(doc);

    this.eventBus.publish(
      new DocumentUpdatedEvent({
        aggregateId: saved.id,
        aggregateType: 'Document',
        workspaceId,
        actorUserId,
        payload: {
          documentId: saved.id,
          projectId: saved.projectId,
          changes: { moved: true, parentId: saved.parentId, order: saved.order },
          lastEditedByUserId: actorUserId,
        },
      }),
    );

    return saved;
  }

  /**
   * Soft-delete a document AND all its descendants in a single transaction.
   *
   * Decision (documented in spec / fase-10 memory): cascade rather than block.
   * The DB schema already enforces ON DELETE CASCADE at the FK level for hard
   * deletes; for soft deletes we walk the subtree and `softRemove` each row so
   * `deletedAt` is consistent across the whole branch. This matches Notion-like
   * UX where deleting a parent page archives its sub-pages too.
   */
  async remove(id: string, workspaceId: string, actorUserId: string): Promise<void> {
    const doc = await this.findOne(id, workspaceId);

    // Collect the subtree using BFS to support arbitrary nesting.
    const subtreeIds: string[] = [doc.id];
    let frontier: string[] = [doc.id];
    while (frontier.length > 0) {
      const children = await this.docRepo.find({
        where: frontier.map((parentId) => ({ workspaceId, parentId })),
        select: ['id'],
      });
      const childIds = children.map((c) => c.id);
      subtreeIds.push(...childIds);
      frontier = childIds;
    }

    await this.docRepo.softDelete(subtreeIds);

    const cascadedChildIds = subtreeIds.filter((sid) => sid !== doc.id);

    this.eventBus.publish(
      new DocumentDeletedEvent({
        aggregateId: doc.id,
        aggregateType: 'Document',
        workspaceId,
        actorUserId,
        payload: {
          documentId: doc.id,
          projectId: doc.projectId,
          actorUserId,
          cascadedChildIds,
        },
      }),
    );
  }

  async list(input: ListDocumentsInput): Promise<DocumentEntity[]> {
    const { workspaceId, projectId, parentId, q } = input;

    const qb = this.docRepo
      .createQueryBuilder('d')
      .where('d.workspaceId = :workspaceId', { workspaceId });

    if (projectId !== undefined) {
      qb.andWhere('d.projectId = :projectId', { projectId });
    }

    if (parentId === null) {
      qb.andWhere('d.parentId IS NULL');
    } else if (typeof parentId === 'string') {
      qb.andWhere('d.parentId = :parentId', { parentId });
    }

    if (q && q.trim().length > 0) {
      const needle = `%${q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((b) => {
          b.where('LOWER(d.title) LIKE :needle', { needle }).orWhere(
            'LOWER(d.contentText) LIKE :needle',
            { needle },
          );
        }),
      );
    }

    qb.orderBy('d.order', 'ASC').addOrderBy('d.createdAt', 'ASC');

    return qb.getMany();
  }

  /**
   * Return the full document tree for a workspace (optionally filtered by
   * project). Performed with a single query plus an in-memory assembly pass.
   */
  async tree(
    workspaceId: string,
    projectId?: string | null,
  ): Promise<DocumentTreeNode[]> {
    const where: Record<string, unknown> = { workspaceId };
    if (projectId === null) {
      where.projectId = IsNull();
    } else if (typeof projectId === 'string') {
      where.projectId = projectId;
    }

    const all = await this.docRepo.find({
      where,
      order: { order: 'ASC', createdAt: 'ASC' },
    });

    const nodes = new Map<string, DocumentTreeNode>();
    for (const doc of all) {
      nodes.set(doc.id, { document: doc, children: [] });
    }

    const roots: DocumentTreeNode[] = [];
    for (const doc of all) {
      const node = nodes.get(doc.id)!;
      if (doc.parentId && nodes.has(doc.parentId)) {
        nodes.get(doc.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
