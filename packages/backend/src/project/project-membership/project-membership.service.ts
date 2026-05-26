import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMembershipEntity } from './project-membership.entity';
import { EventBusService } from '../../events/event-bus.service';
import {
  ProjectMemberAddedEvent,
  ProjectMemberRemovedEvent,
  ProjectMemberRoleChangedEvent,
} from '../events';
import { ProjectRole } from '@jitre/shared';
import { ChatService } from '../../chat/chat.service';

export interface ProjectMemberSummary {
  id: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  assignedAt: Date;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

@Injectable()
export class ProjectMembershipService {
  constructor(
    @InjectRepository(ProjectMembershipEntity)
    private readonly memberRepo: Repository<ProjectMembershipEntity>,
    private readonly chatService: ChatService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Adds a member to a project. Idempotent: if already a member, updates role.
   */
  async addMember(
    projectId: string,
    workspaceId: string,
    userId: string,
    role: ProjectRole,
    actorUserId?: string,
  ): Promise<ProjectMembershipEntity> {
    const existing = await this.memberRepo.findOne({
      where: { projectId, workspaceId, userId },
    });

    if (existing) {
      // Idempotent: update role
      existing.role = role;
    const saved = await this.memberRepo.save(existing);
    await this.syncProjectChatMember(projectId, workspaceId, userId, 'add');

    this.eventBus.publish(
        new ProjectMemberAddedEvent({
          aggregateId: saved.id,
          aggregateType: 'Project',
          actorUserId,
          workspaceId,
          payload: { projectId, userId, role },
        }),
      );

      return saved;
    }

    const membership = this.memberRepo.create({
      workspaceId,
      projectId,
      userId,
      role,
    });
    const saved = await this.memberRepo.save(membership);
    await this.syncProjectChatMember(projectId, workspaceId, userId, 'add');

    this.eventBus.publish(
      new ProjectMemberAddedEvent({
        aggregateId: saved.id,
        aggregateType: 'Project',
        actorUserId,
        workspaceId,
        payload: { projectId, userId, role },
      }),
    );

    return saved;
  }

  /**
   * Removes a member from a project. Refuses if user is the last ADMIN (per design).
   */
  async removeMember(
    projectId: string,
    workspaceId: string,
    userId: string,
    actorUserId?: string,
  ): Promise<void> {
    const membership = await this.memberRepo.findOne({
      where: { projectId, workspaceId, userId },
    });
    if (!membership)
      throw new NotFoundException('PROJECT_MEMBERSHIP_NOT_FOUND');

    if (membership.role === ProjectRole.ADMIN) {
      const adminCount = await this.memberRepo.count({
        where: { projectId, workspaceId, role: ProjectRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ConflictException('LAST_PROJECT_ADMIN');
      }
    }

    await this.memberRepo.delete({ projectId, workspaceId, userId });
    await this.syncProjectChatMember(projectId, workspaceId, userId, 'remove');

    this.eventBus.publish(
      new ProjectMemberRemovedEvent({
        aggregateId: membership.id,
        aggregateType: 'Project',
        actorUserId,
        workspaceId: membership.workspaceId,
        payload: { projectId, userId, previousRole: membership.role },
      }),
    );
  }

  /**
   * Changes the role of a project member. Refuses if demoting the last ADMIN.
   */
  async changeRole(
    projectId: string,
    workspaceId: string,
    userId: string,
    newRole: ProjectRole,
    actorUserId?: string,
  ): Promise<ProjectMembershipEntity> {
    const membership = await this.memberRepo.findOne({
      where: { projectId, workspaceId, userId },
    });
    if (!membership)
      throw new NotFoundException('PROJECT_MEMBERSHIP_NOT_FOUND');

    const prevRole = membership.role;

    // Block demoting the last ADMIN
    if (prevRole === ProjectRole.ADMIN && newRole !== ProjectRole.ADMIN) {
      const adminCount = await this.memberRepo.count({
        where: { projectId, workspaceId, role: ProjectRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ConflictException('LAST_PROJECT_ADMIN');
      }
    }

    membership.role = newRole;
    const saved = await this.memberRepo.save(membership);

    this.eventBus.publish(
      new ProjectMemberRoleChangedEvent({
        aggregateId: saved.id,
        aggregateType: 'Project',
        actorUserId,
        workspaceId: saved.workspaceId,
        payload: { projectId, userId, previousRole: prevRole, newRole },
      }),
    );

    return saved;
  }

  async listMembers(projectId: string, workspaceId: string): Promise<ProjectMemberSummary[]> {
    const memberships = await this.memberRepo.find({
      where: { projectId, workspaceId },
      relations: { user: true },
      order: { assignedAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      id: membership.id,
      workspaceId: membership.workspaceId,
      projectId: membership.projectId,
      userId: membership.userId,
      role: membership.role,
      assignedAt: membership.assignedAt,
      displayName: membership.user?.displayName ?? membership.userId,
      email: membership.user?.email ?? '',
      avatarUrl: membership.user?.avatarUrl ?? null,
    }));
  }

  async findMembership(
    projectId: string,
    workspaceId: string,
    userId: string,
  ): Promise<ProjectMembershipEntity | null> {
    return this.memberRepo.findOne({ where: { projectId, workspaceId, userId } });
  }

  /**
   * Fase 8 ADR-6 — Returns all project IDs that a user is a member of within a workspace.
   * Used by workspace-scope analytics endpoints to filter data to visible projects only.
   */
  async findProjectIdsForUser(
    workspaceId: string,
    userId: string,
  ): Promise<string[]> {
    const memberships = await this.memberRepo.find({
      where: { workspaceId, userId },
      select: ['projectId'],
    });
    return memberships.map((m) => m.projectId);
  }

  private async syncProjectChatMember(
    projectId: string,
    workspaceId: string,
    userId: string,
    action: 'add' | 'remove',
  ): Promise<void> {
    try {
      const channel = await this.chatService.getProjectChannel(projectId, workspaceId);
      if (action === 'add') {
        await this.chatService.addMember(channel.id, workspaceId, userId);
      } else {
        await this.chatService.removeMember(channel.id, workspaceId, userId);
      }
    } catch (error) {
      if (
        error instanceof NotFoundException &&
        error.message === 'PROJECT_CHANNEL_NOT_FOUND'
      ) {
        return;
      }
      throw error;
    }
  }
}
