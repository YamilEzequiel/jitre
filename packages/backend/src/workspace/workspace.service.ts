import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, IsNull, Not } from 'typeorm';
import { WorkspaceEntity } from './workspace.entity';
import { WorkspaceMembershipEntity } from './workspace-membership.entity';
import { WorkspaceRole } from '@jitre/shared';
import { EventBusService } from '../events/event-bus.service';
import {
  WorkspaceCreatedEvent,
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberRoleChangedEvent,
} from '../events';

interface CreateWorkspaceDto {
  name: string;
  slug?: string;
  description?: string;
}

interface AddMemberDto {
  userId: string;
  role: WorkspaceRole;
  actorUserId?: string;
}

export interface WorkspaceContact {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly wsRepo: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMembershipEntity)
    private readonly memberRepo: Repository<WorkspaceMembershipEntity>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    ownerId: string,
    dto: CreateWorkspaceDto,
  ): Promise<WorkspaceEntity> {
    const { workspace, membership } = await this.dataSource.transaction(
      async (em: EntityManager) => {
        const slug = dto.slug ?? (await this.generateSlug(dto.name, em));
        const ws = em.create(WorkspaceEntity, {
          name: dto.name,
          slug,
          description: dto.description,
          ownerId,
        });
        const savedWs = await em.save(WorkspaceEntity, ws);

        const mem = em.create(WorkspaceMembershipEntity, {
          userId: ownerId,
          workspaceId: savedWs.id,
          role: WorkspaceRole.OWNER,
        });
        const savedMem = await em.save(WorkspaceMembershipEntity, mem);

        return { workspace: savedWs, membership: savedMem };
      },
    );

    this.eventBus.publish(
      new WorkspaceCreatedEvent({
        aggregateId: workspace.id,
        aggregateType: 'Workspace',
        actorUserId: ownerId,
        workspaceId: workspace.id,
        payload: { name: workspace.name, slug: workspace.slug },
      }),
    );

    this.eventBus.publish(
      new WorkspaceMemberAddedEvent({
        aggregateId: membership.id,
        aggregateType: 'WorkspaceMembership',
        actorUserId: ownerId,
        workspaceId: workspace.id,
        payload: { addedUserId: ownerId, role: WorkspaceRole.OWNER },
      }),
    );

    return workspace;
  }

  async listForUser(userId: string): Promise<WorkspaceEntity[]> {
    return this.wsRepo.find({
      where: {
        memberships: { userId },
        deletedAt: IsNull(),
      },
      relations: { memberships: true },
    });
  }

  async findMembership(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembershipEntity | null> {
    return this.memberRepo.findOne({ where: { userId, workspaceId } });
  }

  async listContacts(workspaceId: string): Promise<WorkspaceContact[]> {
    const memberships = await this.memberRepo.find({
      where: { workspaceId, deletedAt: IsNull() },
      relations: { user: true },
    });

    return memberships.map((membership) => ({
      userId: membership.userId,
      displayName: membership.user.displayName,
      email: membership.user.email,
      avatarUrl: membership.user.avatarUrl,
      role: membership.role,
    }));
  }

  async addMember(
    workspaceId: string,
    dto: AddMemberDto,
  ): Promise<WorkspaceMembershipEntity> {
    const existing = await this.memberRepo.findOne({
      where: { userId: dto.userId, workspaceId },
    });
    if (existing) {
      throw new ConflictException('ALREADY_MEMBER');
    }
    const membership = this.memberRepo.create({
      userId: dto.userId,
      workspaceId,
      role: dto.role,
    });
    const saved = await this.memberRepo.save(membership);

    this.eventBus.publish(
      new WorkspaceMemberAddedEvent({
        aggregateId: saved.id,
        aggregateType: 'WorkspaceMembership',
        actorUserId: dto.actorUserId,
        workspaceId,
        payload: { addedUserId: dto.userId, role: dto.role },
      }),
    );

    return saved;
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    let removedMembership: WorkspaceMembershipEntity | null = null;

    await this.dataSource.transaction(async (em: EntityManager) => {
      const membership = await em.findOne(WorkspaceMembershipEntity, {
        where: { userId, workspaceId },
      });
      if (!membership) return;

      if (membership.role === WorkspaceRole.OWNER) {
        const ownerCount = await em.count(WorkspaceMembershipEntity, {
          where: { workspaceId, role: WorkspaceRole.OWNER },
        });
        if (ownerCount <= 1) {
          throw new ConflictException('LAST_OWNER');
        }
      }

      await em.softDelete(WorkspaceMembershipEntity, { id: membership.id });
      removedMembership = membership;
    });

    if (removedMembership) {
      const m = removedMembership as WorkspaceMembershipEntity;
      this.eventBus.publish(
        new WorkspaceMemberRemovedEvent({
          aggregateId: m.id,
          aggregateType: 'WorkspaceMembership',
          workspaceId,
          payload: {
            removedUserId: userId,
            previousRole: m.role as WorkspaceRole,
          },
        }),
      );
    }
  }

  /**
   * Changes the role of an existing workspace membership.
   *
   * Guards:
   *  - CANNOT_CHANGE_OWN_ROLE: the actor may not edit their own role
   *  - OWNER_REQUIRED: only an OWNER may promote to or demote away from OWNER
   *  - MEMBER_NOT_FOUND: the target user is not a member of this workspace
   *  - LAST_OWNER: cannot demote the only remaining OWNER
   */
  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    newRole: WorkspaceRole,
    actorUserId: string,
    actorRole: WorkspaceRole,
  ): Promise<WorkspaceMembershipEntity> {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException('CANNOT_CHANGE_OWN_ROLE');
    }

    const membership = await this.memberRepo.findOne({
      where: { workspaceId, userId: targetUserId, deletedAt: IsNull() },
    });
    if (!membership) {
      throw new NotFoundException('MEMBER_NOT_FOUND');
    }

    const previousRole = membership.role as WorkspaceRole;

    // Only OWNERs can touch ownership (either grant it or revoke it).
    if (
      (newRole === WorkspaceRole.OWNER ||
        previousRole === WorkspaceRole.OWNER) &&
      actorRole !== WorkspaceRole.OWNER
    ) {
      throw new ForbiddenException('OWNER_REQUIRED');
    }

    // No-op early return — still return the entity for caller symmetry.
    if (previousRole === newRole) {
      return membership;
    }

    // If demoting an OWNER, make sure at least one OWNER remains afterwards.
    if (
      previousRole === WorkspaceRole.OWNER &&
      newRole !== WorkspaceRole.OWNER
    ) {
      const remainingOwners = await this.memberRepo.count({
        where: {
          workspaceId,
          role: WorkspaceRole.OWNER,
          userId: Not(targetUserId),
          deletedAt: IsNull(),
        },
      });
      if (remainingOwners < 1) {
        throw new ConflictException('LAST_OWNER');
      }
    }

    membership.role = newRole;
    const saved = await this.memberRepo.save(membership);

    this.eventBus.publish(
      new WorkspaceMemberRoleChangedEvent({
        aggregateId: saved.id,
        aggregateType: 'WorkspaceMembership',
        actorUserId,
        workspaceId,
        payload: { targetUserId, previousRole, newRole },
      }),
    );

    return saved;
  }

  async update(
    workspaceId: string,
    patch: { name?: string; description?: string },
  ): Promise<WorkspaceEntity> {
    await this.wsRepo.update(workspaceId, patch);
    const updated = await this.wsRepo.findOne({ where: { id: workspaceId } });
    if (!updated) throw new ConflictException('WORKSPACE_NOT_FOUND');
    return updated;
  }

  private async generateSlug(name: string, em: EntityManager): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    for (let i = 0; i < 100; i++) {
      const candidate = i === 0 ? base : `${base}-${i}`;
      const existing = await em.findOne(WorkspaceEntity, {
        where: { slug: candidate },
      });
      if (!existing) return candidate;
    }

    throw new Error('SLUG_EXHAUSTED');
  }
}
