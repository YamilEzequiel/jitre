import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, QueryFailedError } from 'typeorm';
import { UserEntity } from './user.entity';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';

export interface EmployeePatch {
  displayName?: string;
  email?: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  hireDate?: string | null;
  birthDate?: string | null;
  address?: string | null;
  bio?: string | null;
  employeeCode?: string | null;
  emergencyContact?: string | null;
  status?: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(WorkspaceMembershipEntity)
    private readonly membershipRepo: Repository<WorkspaceMembershipEntity>,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<UserEntity> {
    const user = this.userRepo.create(input);
    try {
      return await this.userRepo.save(user);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code: string }).code === '23505'
      ) {
        throw new ConflictException('EMAIL_TAKEN');
      }
      throw err;
    }
  }

  async updateLastLoginAt(id: string): Promise<void> {
    await this.userRepo.update(id, { lastLoginAt: new Date() });
  }

  async updateProfile(
    id: string,
    patch: {
      displayName?: string;
      email?: string;
      emailMentions?: boolean;
      emailAssignments?: boolean;
      emailDueDates?: boolean;
    },
  ): Promise<UserEntity> {
    try {
      await this.userRepo.update(id, patch);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code: string }).code === '23505'
      ) {
        throw new ConflictException('EMAIL_TAKEN');
      }
      throw err;
    }
    const updated = await this.userRepo.findOne({ where: { id } });
    if (!updated) throw new ConflictException('USER_NOT_FOUND');
    return updated;
  }

  /**
   * List all employees in a workspace. An "employee" here is a user with a
   * (non-deleted) workspace membership. Returns full user records (sans
   * passwordHash) joined with their membership role so the UI can show a
   * single, ready-to-render list. Sorted by displayName.
   */
  async listEmployees(workspaceId: string): Promise<
    Array<UserEntity & { workspaceRole: string }>
  > {
    const memberships = await this.membershipRepo.find({
      where: { workspaceId },
      select: ['userId', 'role'],
    });
    if (memberships.length === 0) return [];

    const userIds = memberships.map((m) => m.userId);
    const users = await this.userRepo.find({ where: { id: In(userIds) } });

    const roleByUser = new Map(memberships.map((m) => [m.userId, m.role]));
    const enriched = users.map((u) => {
      const { passwordHash: _, ...rest } = u as unknown as Record<string, unknown>;
      return {
        ...rest,
        workspaceRole: roleByUser.get(u.id) ?? 'member',
      } as unknown as UserEntity & { workspaceRole: string };
    });
    enriched.sort((a, b) =>
      (a.displayName ?? '').localeCompare(b.displayName ?? ''),
    );
    return enriched;
  }

  /**
   * Apply employee-style fields to a user. Only keys present in the patch get
   * touched; explicit `null` clears the column. Throws EMAIL_TAKEN on unique
   * violation, USER_NOT_FOUND if the row vanishes between update + reload.
   */
  async updateEmployee(id: string, patch: EmployeePatch): Promise<UserEntity> {
    // Strip keys that are `undefined` so we don't accidentally null columns
    // the caller did not mean to touch (PATCH semantics).
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) sanitized[k] = v;
    }
    if (Object.keys(sanitized).length === 0) {
      const current = await this.userRepo.findOne({ where: { id } });
      if (!current) throw new NotFoundException('USER_NOT_FOUND');
      return current;
    }
    try {
      await this.userRepo.update(id, sanitized);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code: string }).code === '23505'
      ) {
        throw new ConflictException('EMAIL_TAKEN');
      }
      throw err;
    }
    const updated = await this.userRepo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('USER_NOT_FOUND');
    return updated;
  }
}
