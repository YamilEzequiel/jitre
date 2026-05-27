import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { WorkspaceRole } from '@jitre/shared';
import { UserReportsToEntity } from './user-reports-to.entity';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';
import { UserEntity } from '../user/user.entity';

export interface OrgGraphNode {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  role: WorkspaceRole;
}

export interface OrgGraphEdge {
  from: string;
  to: string;
}

export interface OrgGraph {
  nodes: OrgGraphNode[];
  edges: OrgGraphEdge[];
}

@Injectable()
export class OrgGraphService {
  constructor(
    @InjectRepository(UserReportsToEntity)
    private readonly reportsRepo: Repository<UserReportsToEntity>,
    @InjectRepository(WorkspaceMembershipEntity)
    private readonly memberRepo: Repository<WorkspaceMembershipEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Returns the full org graph for a workspace:
   *  - One node per active workspace member.
   *  - One edge per active reports-to relationship.
   *
   * `position` (the column on UserEntity used to store an employee's job
   * title) is mapped to `jobTitle` in the node DTO.
   */
  async getOrgGraph(workspaceId: string): Promise<OrgGraph> {
    const memberships = await this.memberRepo.find({
      where: { workspaceId, deletedAt: IsNull() },
      relations: { user: true },
    });

    const nodes: OrgGraphNode[] = memberships.map((m) => ({
      id: m.userId,
      displayName: m.user.displayName,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      jobTitle: m.user.position,
      role: m.role as WorkspaceRole,
    }));

    const relations = await this.reportsRepo.find({
      where: { workspaceId, deletedAt: IsNull() },
    });

    const edges: OrgGraphEdge[] = relations.map((r) => ({
      from: r.userId,
      to: r.reportsToUserId,
    }));

    return { nodes, edges };
  }

  /**
   * Creates an active reports-to relationship between `userId` (reporter) and
   * `supervisorId` (manager) in `workspaceId`.
   *
   * Validations:
   *  - `userId === supervisorId` → BadRequestException('SELF_REPORT_FORBIDDEN')
   *  - Either user not an active member of the workspace
   *    → NotFoundException('USER_NOT_IN_WORKSPACE')
   *  - There's an active reverse edge (supervisor reports to user)
   *    → ConflictException('DIRECT_CYCLE')
   *  - Idempotent: if an identical active edge already exists, return it.
   *
   * v1 only detects DIRECT cycles (A→B and B→A). Multi-hop cycles
   * (A→B→C→A) are NOT detected. See module docs for rationale.
   */
  async addReport(
    workspaceId: string,
    userId: string,
    supervisorId: string,
    actorUserId: string,
  ): Promise<UserReportsToEntity> {
    if (userId === supervisorId) {
      throw new BadRequestException('SELF_REPORT_FORBIDDEN');
    }

    const members = await this.memberRepo.find({
      where: {
        workspaceId,
        userId: In([userId, supervisorId]),
        deletedAt: IsNull(),
      },
    });
    const memberUserIds = new Set(members.map((m) => m.userId));
    if (!memberUserIds.has(userId) || !memberUserIds.has(supervisorId)) {
      throw new NotFoundException('USER_NOT_IN_WORKSPACE');
    }

    // Direct cycle: supervisor already reports to the same userId
    const reverse = await this.reportsRepo.findOne({
      where: {
        workspaceId,
        userId: supervisorId,
        reportsToUserId: userId,
        deletedAt: IsNull(),
      },
    });
    if (reverse) {
      throw new ConflictException('DIRECT_CYCLE');
    }

    // Idempotent: return existing active edge if it exists
    const existing = await this.reportsRepo.findOne({
      where: {
        workspaceId,
        userId,
        reportsToUserId: supervisorId,
        deletedAt: IsNull(),
      },
    });
    if (existing) {
      return existing;
    }

    const row = this.reportsRepo.create({
      workspaceId,
      userId,
      reportsToUserId: supervisorId,
      createdByUserId: actorUserId,
    });
    return this.reportsRepo.save(row);
  }

  /**
   * Soft-deletes the active reports-to relationship `(userId → supervisorId)`
   * in `workspaceId`. Throws `NotFoundException('REPORT_NOT_FOUND')` when no
   * active edge exists.
   */
  async removeReport(
    workspaceId: string,
    userId: string,
    supervisorId: string,
  ): Promise<void> {
    const existing = await this.reportsRepo.findOne({
      where: {
        workspaceId,
        userId,
        reportsToUserId: supervisorId,
        deletedAt: IsNull(),
      },
    });
    if (!existing) {
      throw new NotFoundException('REPORT_NOT_FOUND');
    }
    await this.reportsRepo.softDelete({ id: existing.id });
  }
}
