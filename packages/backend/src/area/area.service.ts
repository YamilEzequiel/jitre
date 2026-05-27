import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { AreaEntity } from './area.entity';
import { UserEntity } from '../user/user.entity';
import { ProjectEntity } from '../project/project.entity';
import { CreateAreaDto, DEFAULT_AREA_COLOR } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

/**
 * Workspace-scoped area / department directory.
 *
 * Soft-delete strategy: when an area is removed we nullify all `users.areaId`
 * and `projects.areaId` columns that referenced it inside the SAME transaction
 * that stamps `deleted_at`. We do this at the service layer (instead of via a
 * DB trigger) because:
 *
 *  - the DB-level FK is `ON DELETE SET NULL`, but that only fires on HARD
 *    deletes. We use soft-delete, so the FK rule never triggers.
 *  - keeping the cascade in code makes the intent obvious to readers and
 *    auditable from a single place, with no migration-time triggers to
 *    maintain.
 */
@Injectable()
export class AreaService {
  constructor(
    @InjectRepository(AreaEntity)
    private readonly areaRepo: Repository<AreaEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /** Lists every active area in `workspaceId`, ordered by name ASC. */
  async list(workspaceId: string): Promise<AreaEntity[]> {
    return this.areaRepo.find({
      where: { workspaceId, deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }

  /**
   * Returns a single active area or throws `NotFoundException('AREA_NOT_FOUND')`
   * when the row does not exist (or has been soft-deleted, or belongs to
   * another workspace).
   */
  async get(id: string, workspaceId: string): Promise<AreaEntity> {
    const area = await this.areaRepo.findOne({
      where: { id, workspaceId, deletedAt: IsNull() },
    });
    if (!area) {
      throw new NotFoundException('AREA_NOT_FOUND');
    }
    return area;
  }

  /**
   * Creates a new area in `workspaceId`. Throws
   * `ConflictException('AREA_NAME_TAKEN')` when the name collides with another
   * ACTIVE area in the same workspace (soft-deleted ones do not block reuse).
   */
  async create(
    workspaceId: string,
    dto: CreateAreaDto,
    actorUserId: string,
  ): Promise<AreaEntity> {
    await this.assertNameAvailable(workspaceId, dto.name);

    const area = this.areaRepo.create({
      workspaceId,
      name: dto.name,
      color: dto.color ?? DEFAULT_AREA_COLOR,
      icon: dto.icon ?? null,
      description: dto.description ?? null,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return this.areaRepo.save(area);
  }

  /**
   * Partial update. When `name` is provided AND it actually changes, we
   * re-run the uniqueness check; same `ConflictException('AREA_NAME_TAKEN')`
   * applies.
   */
  async update(
    id: string,
    workspaceId: string,
    dto: UpdateAreaDto,
  ): Promise<AreaEntity> {
    const area = await this.get(id, workspaceId);

    if (dto.name !== undefined && dto.name !== area.name) {
      await this.assertNameAvailable(workspaceId, dto.name, id);
      area.name = dto.name;
    }
    if (dto.color !== undefined) area.color = dto.color;
    if (dto.icon !== undefined) area.icon = dto.icon ?? null;
    if (dto.description !== undefined) {
      area.description = dto.description ?? null;
    }

    return this.areaRepo.save(area);
  }

  /**
   * Soft-deletes the area AND nullifies every `users.areaId` / `projects.areaId`
   * that referenced it. All three writes happen in a single transaction so
   * a partially-cascaded state is never visible.
   */
  async softDelete(id: string, workspaceId: string): Promise<void> {
    const area = await this.get(id, workspaceId);

    await this.dataSource.transaction(async (em: EntityManager) => {
      await em.update(
        UserEntity,
        { areaId: area.id },
        { areaId: null },
      );
      await em.update(
        ProjectEntity,
        { workspaceId, areaId: area.id },
        { areaId: null },
      );
      await em.softDelete(AreaEntity, { id: area.id });
    });
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async assertNameAvailable(
    workspaceId: string,
    name: string,
    ignoreId?: string,
  ): Promise<void> {
    const where = ignoreId
      ? { workspaceId, name, deletedAt: IsNull(), id: Not(ignoreId) }
      : { workspaceId, name, deletedAt: IsNull() };
    const existing = await this.areaRepo.findOne({ where });
    if (existing) {
      throw new ConflictException('AREA_NAME_TAKEN');
    }
  }
}
