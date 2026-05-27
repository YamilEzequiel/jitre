/* eslint-disable no-console */
/**
 * Jitre Demo Seed
 * ----------------
 * Standalone CLI script that populates the database with a realistic demo
 * dataset so a developer can `npm run seed`, log in with the printed
 * credentials and see the whole product wired up end-to-end.
 *
 * Run:  npm run seed   (from packages/backend)
 *
 * Design notes
 * - Uses TypeORM repositories directly: services require tenancy + DI context
 *   that doesn't make sense outside a NestJS request lifecycle.
 * - Idempotent: every insert checks for existence first (by email / slug /
 *   project key / natural key). Running twice does not duplicate rows.
 * - Passwords use argon2 (the real algorithm, via @node-rs/argon2) — bcrypt
 *   would not work against the live auth code.
 * - Audit columns (createdBy / updatedBy) are left null on purpose; the
 *   AuditSubscriber falls back to null when no CLS context is active.
 */
import 'reflect-metadata';
import { hash } from '@node-rs/argon2';
import type { Algorithm } from '@node-rs/argon2';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { AppDataSource } from './data-source';
import { UserEntity } from '../user/user.entity';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';
import { ProjectEntity } from '../project/project.entity';
import { ProjectMembershipEntity } from '../project/project-membership/project-membership.entity';
import { StatusEntity } from '../project/status/status.entity';
import { LabelEntity } from '../project/label/label.entity';
import { TaskEntity } from '../task/task.entity';
import { TaskAssignmentEntity } from '../task/task-assignment.entity';
import { TaskLabelEntity } from '../task/task-label.entity';
import { Comment } from '../comment/comment.entity';
import { DocumentEntity } from '../document/document.entity';
import { ChatChannelEntity, ChatChannelKind } from '../chat/chat-channel.entity';
import { ChatMembershipEntity } from '../chat/chat-membership.entity';
import { ChatMessageEntity } from '../chat/chat-message.entity';
import { TimeEntryEntity } from '../time-tracking/time-entry.entity';
import { Notification } from '../notification/notification.entity';
import { PlanningItemEntity, PlanningItemType } from '../project/planning/planning-item.entity';
import { AiPromptTemplateEntity } from '../ai/prompt-template/ai-prompt-template.entity';
import { BUILTIN_PROMPT_TEMPLATES } from '../ai/prompt-template/builtin-templates';

import {
  WorkspaceRole,
  ProjectRole,
  ProjectStatus,
  StatusCategory,
  LabelScope,
  TaskPriority,
  TaskType,
  TaskStatus,
  CommentContext,
  NotificationType,
} from '@jitre/shared';

// argon2 const-enum runtime workaround (same trick as PasswordHasherService).
const ARGON2ID = 2 satisfies Algorithm;
const ARGON2_OPTS = {
  algorithm: ARGON2ID,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

type Repo<T extends { id?: string }> = Repository<T>;

interface UserSeed {
  email: string;
  displayName: string;
  password: string;
  role: WorkspaceRole;
}

interface SeededUsers {
  admin: UserEntity;
  pm: UserEntity;
  dev1: UserEntity;
  dev2: UserEntity;
}

interface SeededStatuses {
  byProject: Map<string, StatusEntity[]>;
}

interface SeededLabels {
  byProject: Map<string, LabelEntity[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  return daysAgo(-n);
}

async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Seeders
// ─────────────────────────────────────────────────────────────────────────────

async function seedUsers(repo: Repo<UserEntity>): Promise<SeededUsers> {
  const definitions: Array<
    UserSeed & {
      key: keyof SeededUsers;
      employee: {
        position: string;
        department: string;
        phone: string;
        hireDate: string;
        employeeCode: string;
        bio: string;
      };
    }
  > = [
    {
      key: 'admin', email: 'admin@jitre.test', displayName: 'Alex Admin',
      password: 'admin123', role: WorkspaceRole.OWNER,
      employee: {
        position: 'CEO & Founder', department: 'Leadership',
        phone: '+54 11 4000-0001', hireDate: '2022-01-15',
        employeeCode: 'EMP-001', bio: 'Founder. Loves shipping fast and well.',
      },
    },
    {
      key: 'pm', email: 'pm@jitre.test', displayName: 'Pat Manager',
      password: 'pm123', role: WorkspaceRole.ADMIN,
      employee: {
        position: 'Product Manager', department: 'Product',
        phone: '+54 11 4000-0002', hireDate: '2022-06-01',
        employeeCode: 'EMP-002', bio: 'Roadmaps, releases, and the occasional sprint demo.',
      },
    },
    {
      key: 'dev1', email: 'dev1@jitre.test', displayName: 'Dani Developer',
      password: 'dev123', role: WorkspaceRole.MEMBER,
      employee: {
        position: 'Senior Engineer', department: 'Engineering',
        phone: '+54 11 4000-0003', hireDate: '2023-03-10',
        employeeCode: 'EMP-003', bio: 'Backend + infra. Coffee budget exhausted.',
      },
    },
    {
      key: 'dev2', email: 'dev2@jitre.test', displayName: 'Sam Engineer',
      password: 'dev123', role: WorkspaceRole.MEMBER,
      employee: {
        position: 'Frontend Engineer', department: 'Engineering',
        phone: '+54 11 4000-0004', hireDate: '2023-09-22',
        employeeCode: 'EMP-004', bio: 'Pixels, animations, and tasteful violet gradients.',
      },
    },
  ];

  const result = {} as SeededUsers;

  for (const def of definitions) {
    let user = await repo.findOne({ where: { email: def.email } });
    if (!user) {
      user = repo.create({
        email: def.email,
        displayName: def.displayName,
        passwordHash: await hashPassword(def.password),
        avatarUrl: null,
        status: 'active',
        lastLoginAt: null,
        position: def.employee.position,
        department: def.employee.department,
        phone: def.employee.phone,
        hireDate: def.employee.hireDate,
        employeeCode: def.employee.employeeCode,
        bio: def.employee.bio,
      });
      user = await repo.save(user);
    } else {
      // Backfill employee fields on existing seeded users (idempotent).
      const patch: Record<string, unknown> = {};
      if (!user.position) patch['position'] = def.employee.position;
      if (!user.department) patch['department'] = def.employee.department;
      if (!user.phone) patch['phone'] = def.employee.phone;
      if (!user.hireDate) patch['hireDate'] = def.employee.hireDate;
      if (!user.employeeCode) patch['employeeCode'] = def.employee.employeeCode;
      if (!user.bio) patch['bio'] = def.employee.bio;
      if (Object.keys(patch).length > 0) {
        await repo.update(user.id, patch);
        Object.assign(user, patch);
      }
    }
    result[def.key] = user;
  }

  return result;
}

async function seedWorkspace(
  repo: Repo<WorkspaceEntity>,
  owner: UserEntity,
): Promise<WorkspaceEntity> {
  let ws = await repo.findOne({ where: { slug: 'jitre-demo' } });
  if (!ws) {
    ws = repo.create({
      name: 'Jitre Demo Co',
      slug: 'jitre-demo',
      description: 'Demo workspace populated by the seed script.',
      ownerId: owner.id,
    });
    ws = await repo.save(ws);
  }
  return ws;
}

async function seedWorkspaceMemberships(
  repo: Repo<WorkspaceMembershipEntity>,
  workspace: WorkspaceEntity,
  users: SeededUsers,
): Promise<void> {
  const memberships: Array<{ user: UserEntity; role: WorkspaceRole }> = [
    { user: users.admin, role: WorkspaceRole.OWNER },
    { user: users.pm, role: WorkspaceRole.ADMIN },
    { user: users.dev1, role: WorkspaceRole.MEMBER },
    { user: users.dev2, role: WorkspaceRole.MEMBER },
  ];

  for (const m of memberships) {
    const existing = await repo.findOne({
      where: { workspaceId: workspace.id, userId: m.user.id },
    });
    if (!existing) {
      await repo.save(
        repo.create({
          workspaceId: workspace.id,
          userId: m.user.id,
          role: m.role,
        }),
      );
    }
  }
}

interface SeededProjects {
  platform: ProjectEntity;
  marketing: ProjectEntity;
}

async function seedProjects(
  repo: Repo<ProjectEntity>,
  workspace: WorkspaceEntity,
  users: SeededUsers,
): Promise<SeededProjects> {
  async function upsert(input: {
    name: string;
    key: string;
    description: string;
    color: string;
    icon: string;
    ownerUserId: string;
  }): Promise<ProjectEntity> {
    let proj = await repo.findOne({
      where: { workspaceId: workspace.id, key: input.key },
    });
    if (!proj) {
      proj = repo.create({
        workspaceId: workspace.id,
        name: input.name,
        key: input.key,
        description: input.description,
        status: ProjectStatus.ACTIVE,
        color: input.color,
        icon: input.icon,
        ownerUserId: input.ownerUserId,
        startDate: daysAgo(60),
        targetDate: daysFromNow(90),
      });
      proj = await repo.save(proj);
    }
    return proj;
  }

  const platform = await upsert({
    name: 'Jitre Platform',
    key: 'JIT',
    description: 'Core platform engineering project.',
    color: '#6366f1',
    icon: 'rocket',
    ownerUserId: users.admin.id,
  });

  const marketing = await upsert({
    name: 'Marketing Site',
    key: 'MKT',
    description: 'Public marketing website + campaigns.',
    color: '#ec4899',
    icon: 'megaphone',
    ownerUserId: users.pm.id,
  });

  return { platform, marketing };
}

async function seedProjectMemberships(
  repo: Repo<ProjectMembershipEntity>,
  workspace: WorkspaceEntity,
  projects: SeededProjects,
  users: SeededUsers,
): Promise<void> {
  const rows: Array<{ projectId: string; userId: string; role: ProjectRole }> = [
    // Jitre Platform
    { projectId: projects.platform.id, userId: users.admin.id, role: ProjectRole.ADMIN },
    { projectId: projects.platform.id, userId: users.pm.id, role: ProjectRole.ADMIN },
    { projectId: projects.platform.id, userId: users.dev1.id, role: ProjectRole.CONTRIBUTOR },
    { projectId: projects.platform.id, userId: users.dev2.id, role: ProjectRole.CONTRIBUTOR },
    // Marketing Site
    { projectId: projects.marketing.id, userId: users.admin.id, role: ProjectRole.VIEWER },
    { projectId: projects.marketing.id, userId: users.pm.id, role: ProjectRole.ADMIN },
    { projectId: projects.marketing.id, userId: users.dev1.id, role: ProjectRole.CONTRIBUTOR },
  ];

  for (const r of rows) {
    const existing = await repo.findOne({
      where: { projectId: r.projectId, userId: r.userId },
    });
    if (!existing) {
      await repo.save(
        repo.create({
          workspaceId: workspace.id,
          projectId: r.projectId,
          userId: r.userId,
          role: r.role,
        }),
      );
    }
  }
}

async function seedStatuses(
  repo: Repo<StatusEntity>,
  workspace: WorkspaceEntity,
  projects: SeededProjects,
): Promise<SeededStatuses> {
  const byProject = new Map<string, StatusEntity[]>();

  const platformStatuses: Array<{
    name: string;
    category: StatusCategory;
    color: string;
    order: number;
    isDefault: boolean;
  }> = [
    { name: 'Backlog', category: StatusCategory.TODO, color: '#94a3b8', order: 0, isDefault: true },
    { name: 'In Progress', category: StatusCategory.IN_PROGRESS, color: '#3b82f6', order: 1, isDefault: false },
    { name: 'In Review', category: StatusCategory.IN_PROGRESS, color: '#f59e0b', order: 2, isDefault: false },
    { name: 'Done', category: StatusCategory.DONE, color: '#10b981', order: 3, isDefault: false },
    { name: 'Cancelled', category: StatusCategory.DONE, color: '#ef4444', order: 4, isDefault: false },
  ];

  const marketingStatuses = platformStatuses.slice(0, 4); // no Cancelled column

  async function upsertStatuses(
    project: ProjectEntity,
    defs: typeof platformStatuses,
  ): Promise<StatusEntity[]> {
    const created: StatusEntity[] = [];
    for (const def of defs) {
      let existing = await repo.findOne({
        where: { workspaceId: workspace.id, projectId: project.id, name: def.name },
      });
      if (!existing) {
        existing = await repo.save(
          repo.create({
            workspaceId: workspace.id,
            projectId: project.id,
            name: def.name,
            color: def.color,
            order: def.order,
            category: def.category,
            isDefault: def.isDefault,
          }),
        );
      }
      created.push(existing);
    }
    return created;
  }

  byProject.set(projects.platform.id, await upsertStatuses(projects.platform, platformStatuses));
  byProject.set(projects.marketing.id, await upsertStatuses(projects.marketing, marketingStatuses));
  return { byProject };
}

async function seedLabels(
  repo: Repo<LabelEntity>,
  workspace: WorkspaceEntity,
  projects: SeededProjects,
): Promise<SeededLabels> {
  const byProject = new Map<string, LabelEntity[]>();

  const platformLabels: Array<{ name: string; color: string }> = [
    { name: 'backend', color: '#6366f1' },
    { name: 'frontend', color: '#0ea5e9' },
    { name: 'bug', color: '#ef4444' },
    { name: 'feature', color: '#10b981' },
    { name: 'tech-debt', color: '#a855f7' },
  ];

  const marketingLabels: Array<{ name: string; color: string }> = [
    { name: 'design', color: '#ec4899' },
    { name: 'copy', color: '#f59e0b' },
    { name: 'seo', color: '#22c55e' },
  ];

  async function upsertLabels(
    project: ProjectEntity,
    defs: Array<{ name: string; color: string }>,
  ): Promise<LabelEntity[]> {
    const out: LabelEntity[] = [];
    for (const def of defs) {
      let existing = await repo.findOne({
        where: { workspaceId: workspace.id, projectId: project.id, name: def.name },
      });
      if (!existing) {
        existing = await repo.save(
          repo.create({
            workspaceId: workspace.id,
            projectId: project.id,
            name: def.name,
            color: def.color,
            scope: LabelScope.PROJECT,
          }),
        );
      }
      out.push(existing);
    }
    return out;
  }

  byProject.set(projects.platform.id, await upsertLabels(projects.platform, platformLabels));
  byProject.set(projects.marketing.id, await upsertLabels(projects.marketing, marketingLabels));
  return { byProject };
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning items (epics, sprints, releases)
// ─────────────────────────────────────────────────────────────────────────────

interface SeededPlanning {
  /** projectId -> { epics, sprints, releases } indexed by `key` for task wiring. */
  byProject: Map<
    string,
    {
      epics: Map<string, PlanningItemEntity>;
      sprints: Map<string, PlanningItemEntity>;
      releases: Map<string, PlanningItemEntity>;
    }
  >;
}

async function seedPlanningItems(
  repo: Repo<PlanningItemEntity>,
  workspace: WorkspaceEntity,
  projects: SeededProjects,
): Promise<SeededPlanning> {
  interface Spec {
    key: string;
    type: PlanningItemType;
    name: string;
    goal: string | null;
    status: string;
    color: string | null;
    startOffsetDays: number | null;
    endOffsetDays: number | null;
  }

  // Two epics, two sprints (one active, one upcoming), one release per project.
  const platformSpecs: Spec[] = [
    { key: 'auth-hardening', type: 'epic', name: 'Auth Hardening', goal: 'Rotate, audit and lock down the auth surface.', status: 'active', color: '#6366f1', startOffsetDays: -30, endOffsetDays: 30 },
    { key: 'kanban-mvp', type: 'epic', name: 'Kanban MVP', goal: 'Ship a usable kanban board v1.', status: 'active', color: '#0ea5e9', startOffsetDays: -14, endOffsetDays: 21 },
    { key: 'sprint-22', type: 'sprint', name: 'Sprint 22', goal: 'Stabilize and ship.', status: 'active', color: '#10b981', startOffsetDays: -7, endOffsetDays: 7 },
    { key: 'sprint-23', type: 'sprint', name: 'Sprint 23', goal: null, status: 'planned', color: '#a855f7', startOffsetDays: 7, endOffsetDays: 21 },
    { key: 'release-1-2', type: 'release', name: 'v1.2', goal: 'Kanban + auth rotation.', status: 'planned', color: '#f59e0b', startOffsetDays: null, endOffsetDays: 30 },
  ];

  const marketingSpecs: Spec[] = [
    { key: 'launch-campaign', type: 'epic', name: 'Launch Campaign', goal: 'Coordinate the public launch.', status: 'active', color: '#ec4899', startOffsetDays: -10, endOffsetDays: 30 },
    { key: 'sprint-mkt-3', type: 'sprint', name: 'MKT Sprint 3', goal: 'Pricing page + hero copy.', status: 'active', color: '#10b981', startOffsetDays: -3, endOffsetDays: 10 },
    { key: 'release-launch', type: 'release', name: 'Launch Day', goal: 'Public launch milestone.', status: 'planned', color: '#f43f5e', startOffsetDays: null, endOffsetDays: 21 },
  ];

  const byProject = new Map<
    string,
    {
      epics: Map<string, PlanningItemEntity>;
      sprints: Map<string, PlanningItemEntity>;
      releases: Map<string, PlanningItemEntity>;
    }
  >();

  async function upsertGroup(project: ProjectEntity, specs: Spec[]) {
    const epics = new Map<string, PlanningItemEntity>();
    const sprints = new Map<string, PlanningItemEntity>();
    const releases = new Map<string, PlanningItemEntity>();
    for (const s of specs) {
      let existing = await repo.findOne({
        where: { workspaceId: workspace.id, projectId: project.id, name: s.name, type: s.type },
      });
      if (!existing) {
        existing = await repo.save(
          repo.create({
            workspaceId: workspace.id,
            projectId: project.id,
            type: s.type,
            name: s.name,
            goal: s.goal,
            status: s.status,
            color: s.color,
            startDate: s.startOffsetDays == null ? null : daysFromNow(s.startOffsetDays),
            endDate: s.endOffsetDays == null ? null : daysFromNow(s.endOffsetDays),
          }),
        );
      }
      if (s.type === 'epic') epics.set(s.key, existing);
      else if (s.type === 'sprint') sprints.set(s.key, existing);
      else releases.set(s.key, existing);
    }
    byProject.set(project.id, { epics, sprints, releases });
  }

  await upsertGroup(projects.platform, platformSpecs);
  await upsertGroup(projects.marketing, marketingSpecs);
  return { byProject };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks
// ─────────────────────────────────────────────────────────────────────────────

interface TaskSpec {
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  statusIdx: number; // index into project status list
  assigneeKeys: Array<keyof SeededUsers>;
  labelNames: string[];
  dueOffsetDays?: number | null;
  rank: string;
  estimatedHours?: number;
  /** Local key used inside the seed to wire subtasks. */
  localKey?: string;
  parentLocalKey?: string;
  /** Optional planning-item keys (resolved against SeededPlanning per project). */
  epicKey?: string;
  sprintKey?: string;
  releaseKey?: string;
}

async function seedTasks(
  repo: Repo<TaskEntity>,
  assignRepo: Repo<TaskAssignmentEntity>,
  labelLinkRepo: Repo<TaskLabelEntity>,
  workspace: WorkspaceEntity,
  projects: SeededProjects,
  statuses: SeededStatuses,
  labels: SeededLabels,
  planning: SeededPlanning,
  users: SeededUsers,
): Promise<TaskEntity[]> {
  const platformStatuses = statuses.byProject.get(projects.platform.id)!;
  const marketingStatuses = statuses.byProject.get(projects.marketing.id)!;
  const platformLabels = labels.byProject.get(projects.platform.id)!;
  const marketingLabels = labels.byProject.get(projects.marketing.id)!;

  function findLabel(list: LabelEntity[], name: string): LabelEntity {
    const lab = list.find((l) => l.name === name);
    if (!lab) throw new Error(`Label not found: ${name}`);
    return lab;
  }

  const platformTasks: TaskSpec[] = [
    { localKey: 'p1', title: 'Set up CI pipeline', type: TaskType.TASK, priority: TaskPriority.HIGH, statusIdx: 3, assigneeKeys: ['admin'], labelNames: ['backend'], rank: 'a', estimatedHours: 6 },
    { localKey: 'p2', title: 'Implement JWT refresh rotation', description: 'Refresh tokens must rotate on each use.\n\n- [ ] Rotate on use\n- [ ] Invalidate previous', type: TaskType.TASK, priority: TaskPriority.HIGH, statusIdx: 1, assigneeKeys: ['dev1'], labelNames: ['backend', 'feature'], dueOffsetDays: 7, rank: 'b', estimatedHours: 10, epicKey: 'auth-hardening', sprintKey: 'sprint-22', releaseKey: 'release-1-2' },
    { localKey: 'p3', title: 'Fix N+1 in task list endpoint', description: 'Reported by perf monitoring on staging.', type: TaskType.BUG, priority: TaskPriority.URGENT, statusIdx: 1, assigneeKeys: ['dev1', 'dev2'], labelNames: ['backend', 'bug'], dueOffsetDays: 2, rank: 'c', estimatedHours: 4, sprintKey: 'sprint-22' },
    { localKey: 'p4', title: 'Build kanban board UI', type: TaskType.TASK, priority: TaskPriority.HIGH, statusIdx: 1, assigneeKeys: ['dev2'], labelNames: ['frontend', 'feature'], dueOffsetDays: 14, rank: 'd', estimatedHours: 16, epicKey: 'kanban-mvp', sprintKey: 'sprint-22', releaseKey: 'release-1-2' },
    { localKey: 'p5', title: 'Drag-and-drop reordering', parentLocalKey: 'p4', type: TaskType.TASK, priority: TaskPriority.MEDIUM, statusIdx: 0, assigneeKeys: ['dev2'], labelNames: ['frontend'], rank: 'da', estimatedHours: 6, epicKey: 'kanban-mvp', sprintKey: 'sprint-23' },
    { localKey: 'p6', title: 'Optimistic UI updates', parentLocalKey: 'p4', type: TaskType.TASK, priority: TaskPriority.MEDIUM, statusIdx: 0, assigneeKeys: ['dev2'], labelNames: ['frontend'], rank: 'db', estimatedHours: 4, epicKey: 'kanban-mvp', sprintKey: 'sprint-23' },
    { localKey: 'p7', title: 'Wire socket.io presence', type: TaskType.FEATURE, priority: TaskPriority.MEDIUM, statusIdx: 2, assigneeKeys: ['dev1'], labelNames: ['backend', 'frontend'], dueOffsetDays: -1, rank: 'e', estimatedHours: 8, sprintKey: 'sprint-22' },
    { localKey: 'p8', title: 'Audit log retention policy', type: TaskType.TASK, priority: TaskPriority.LOW, statusIdx: 0, assigneeKeys: [], labelNames: ['backend', 'tech-debt'], rank: 'f', estimatedHours: 3 },
    { localKey: 'p9', title: 'Replace TODO comments with issues', type: TaskType.TASK, priority: TaskPriority.LOW, statusIdx: 0, assigneeKeys: [], labelNames: ['tech-debt'], rank: 'g' },
    { localKey: 'p10', title: 'Crash on attachment upload over 10MB', description: 'Stack trace attached.', type: TaskType.BUG, priority: TaskPriority.HIGH, statusIdx: 2, assigneeKeys: ['dev1'], labelNames: ['backend', 'bug'], dueOffsetDays: 3, rank: 'h', estimatedHours: 5, sprintKey: 'sprint-22' },
    { localKey: 'p11', title: 'Production outage 2026-04-12', description: 'Postmortem in /docs.', type: TaskType.INCIDENT, priority: TaskPriority.URGENT, statusIdx: 3, assigneeKeys: ['admin', 'dev1'], labelNames: ['backend'], rank: 'i' },
    { localKey: 'p12', title: 'Migrate to TypeORM 0.3 query builder', type: TaskType.TASK, priority: TaskPriority.MEDIUM, statusIdx: 0, assigneeKeys: ['dev1'], labelNames: ['backend', 'tech-debt'], rank: 'j', estimatedHours: 8 },
    { localKey: 'p13', title: 'Add dark mode toggle', type: TaskType.FEATURE, priority: TaskPriority.LOW, statusIdx: 0, assigneeKeys: ['dev2'], labelNames: ['frontend'], rank: 'k', estimatedHours: 3, sprintKey: 'sprint-23' },
    { localKey: 'p14', title: 'Settings page split into tabs', parentLocalKey: 'p13', type: TaskType.TASK, priority: TaskPriority.LOW, statusIdx: 0, assigneeKeys: ['dev2'], labelNames: ['frontend'], rank: 'ka' },
    { localKey: 'p15', title: 'Login form double-submit bug', type: TaskType.BUG, priority: TaskPriority.MEDIUM, statusIdx: 1, assigneeKeys: ['dev2'], labelNames: ['frontend', 'bug'], dueOffsetDays: -3, rank: 'l', estimatedHours: 2, sprintKey: 'sprint-22' },
    { localKey: 'p16', title: 'Webhook delivery retry queue', type: TaskType.TASK, priority: TaskPriority.MEDIUM, statusIdx: 2, assigneeKeys: ['dev1'], labelNames: ['backend'], dueOffsetDays: 10, rank: 'm', estimatedHours: 6, sprintKey: 'sprint-23', releaseKey: 'release-1-2' },
    { localKey: 'p17', title: 'Document API rate limits', type: TaskType.TASK, priority: TaskPriority.LOW, statusIdx: 0, assigneeKeys: ['pm'], labelNames: ['backend'], rank: 'n' },
    { localKey: 'p18', title: 'Empty state illustrations', type: TaskType.TASK, priority: TaskPriority.NONE, statusIdx: 0, assigneeKeys: [], labelNames: ['frontend'], rank: 'o' },
  ];

  const marketingTasks: TaskSpec[] = [
    { localKey: 'm1', title: 'Landing hero copy v2', type: TaskType.TASK, priority: TaskPriority.HIGH, statusIdx: 1, assigneeKeys: ['pm'], labelNames: ['copy', 'design'], dueOffsetDays: 4, rank: 'a', estimatedHours: 3, epicKey: 'launch-campaign', sprintKey: 'sprint-mkt-3', releaseKey: 'release-launch' },
    { localKey: 'm2', title: 'SEO audit Q2', type: TaskType.TASK, priority: TaskPriority.MEDIUM, statusIdx: 0, assigneeKeys: ['pm'], labelNames: ['seo'], rank: 'b', estimatedHours: 5 },
    { localKey: 'm3', title: 'Sub-tasks: meta tags', parentLocalKey: 'm2', type: TaskType.TASK, priority: TaskPriority.MEDIUM, statusIdx: 0, assigneeKeys: ['dev1'], labelNames: ['seo'], rank: 'ba' },
    { localKey: 'm4', title: 'Pricing page broken layout on mobile', type: TaskType.BUG, priority: TaskPriority.HIGH, statusIdx: 1, assigneeKeys: ['dev1'], labelNames: ['design'], dueOffsetDays: 1, rank: 'c', estimatedHours: 2, sprintKey: 'sprint-mkt-3' },
    { localKey: 'm5', title: 'Blog post: Why we built Jitre', type: TaskType.TASK, priority: TaskPriority.LOW, statusIdx: 3, assigneeKeys: ['pm'], labelNames: ['copy'], rank: 'd' },
    { localKey: 'm6', title: 'OG image template', type: TaskType.TASK, priority: TaskPriority.MEDIUM, statusIdx: 2, assigneeKeys: ['pm'], labelNames: ['design'], rank: 'e', estimatedHours: 2, epicKey: 'launch-campaign', sprintKey: 'sprint-mkt-3' },
    { localKey: 'm7', title: 'Launch announcement email', type: TaskType.FEATURE, priority: TaskPriority.URGENT, statusIdx: 0, assigneeKeys: ['pm'], labelNames: ['copy'], dueOffsetDays: 12, rank: 'f', epicKey: 'launch-campaign', releaseKey: 'release-launch' },
  ];

  function userByKey(k: keyof SeededUsers): UserEntity {
    return users[k];
  }

  async function persistGroup(
    project: ProjectEntity,
    statusList: StatusEntity[],
    labelList: LabelEntity[],
    specs: TaskSpec[],
  ): Promise<TaskEntity[]> {
    const created = new Map<string, TaskEntity>();
    // First pass: create parents (no parentLocalKey), then children.
    const ordered = [...specs.filter((s) => !s.parentLocalKey), ...specs.filter((s) => !!s.parentLocalKey)];

    // Bootstrap issue_number counter from the current max for this project so
    // a re-run picks up where the previous one (or the migration backfill)
    // left off — no duplicate issue keys.
    const maxRow = await repo
      .createQueryBuilder('t')
      .select('COALESCE(MAX(t.issueNumber), 0)', 'max')
      .where('t.projectId = :pid', { pid: project.id })
      .getRawOne<{ max: string | number | null }>();
    let nextIssueNumber = Number(maxRow?.max ?? 0);

    const planningForProject = planning.byProject.get(project.id);
    function planningId(
      group: 'epics' | 'sprints' | 'releases',
      key: string | undefined,
    ): string | null {
      if (!key || !planningForProject) return null;
      return planningForProject[group].get(key)?.id ?? null;
    }

    for (const spec of ordered) {
      const status = statusList[spec.statusIdx];
      const parent = spec.parentLocalKey ? created.get(spec.parentLocalKey) : undefined;
      let task = await repo.findOne({
        where: {
          workspaceId: workspace.id,
          projectId: project.id,
          title: spec.title,
        },
      });
      if (!task) {
        nextIssueNumber += 1;
        task = repo.create({
          workspaceId: workspace.id,
          projectId: project.id,
          statusId: status.id,
          issueNumber: nextIssueNumber,
          issueKey: `${project.key}-${nextIssueNumber}`,
          title: spec.title,
          description: spec.description ?? null,
          priority: spec.priority,
          type: spec.type,
          dueDate: spec.dueOffsetDays == null ? null : daysFromNow(spec.dueOffsetDays),
          startDate: null,
          estimatedHours: spec.estimatedHours ?? null,
          parentTaskId: parent?.id ?? null,
          epicId: planningId('epics', spec.epicKey),
          sprintId: planningId('sprints', spec.sprintKey),
          releaseId: planningId('releases', spec.releaseKey),
          rank: spec.rank,
          customFields: {},
          completedAt:
            status.category === StatusCategory.DONE
              ? daysAgo(Math.floor(Math.random() * 10) + 1)
              : null,
        });
        task = await repo.save(task);
      } else {
        // Task exists from a previous run — backfill planning links if they
        // weren't set (e.g. seed pre-planning). Idempotent: only writes diff.
        const patch: { epicId?: string; sprintId?: string; releaseId?: string } = {};
        const wantedEpic = planningId('epics', spec.epicKey);
        const wantedSprint = planningId('sprints', spec.sprintKey);
        const wantedRelease = planningId('releases', spec.releaseKey);
        if (wantedEpic && task.epicId !== wantedEpic) patch.epicId = wantedEpic;
        if (wantedSprint && task.sprintId !== wantedSprint) patch.sprintId = wantedSprint;
        if (wantedRelease && task.releaseId !== wantedRelease) patch.releaseId = wantedRelease;
        if (Object.keys(patch).length > 0) {
          await repo.update(task.id, patch);
          Object.assign(task, patch);
        }
      }
      if (spec.localKey) created.set(spec.localKey, task);

      // Assignments
      for (const k of spec.assigneeKeys) {
        const u = userByKey(k);
        const existing = await assignRepo.findOne({
          where: { taskId: task.id, userId: u.id },
        });
        if (!existing) {
          await assignRepo.save(
            assignRepo.create({
              workspaceId: workspace.id,
              taskId: task.id,
              userId: u.id,
              assignedByUserId: users.admin.id,
            }),
          );
        }
      }

      // Labels
      for (const lname of spec.labelNames) {
        const label = findLabel(labelList, lname);
        const existing = await labelLinkRepo.findOne({
          where: { taskId: task.id, labelId: label.id },
        });
        if (!existing) {
          await labelLinkRepo.save(
            labelLinkRepo.create({
              workspaceId: workspace.id,
              taskId: task.id,
              labelId: label.id,
            }),
          );
        }
      }
    }

    return Array.from(created.values());
  }

  const platformCreated = await persistGroup(projects.platform, platformStatuses, platformLabels, platformTasks);
  const marketingCreated = await persistGroup(projects.marketing, marketingStatuses, marketingLabels, marketingTasks);
  return [...platformCreated, ...marketingCreated];
}

// ─────────────────────────────────────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────────────────────────────────────

async function seedComments(
  repo: Repo<Comment>,
  workspace: WorkspaceEntity,
  tasks: TaskEntity[],
  users: SeededUsers,
): Promise<number> {
  const threads: Array<{
    taskTitle: string;
    messages: Array<{ author: keyof SeededUsers; body: string; replyIdx?: number }>;
  }> = [
    {
      taskTitle: 'Implement JWT refresh rotation',
      messages: [
        { author: 'admin', body: 'Make sure we rotate on every use, not just on refresh.' },
        { author: 'dev1', body: 'Got it. Will also invalidate the previous one.' },
        { author: 'pm', body: 'Can we get a quick demo on Friday?', replyIdx: 1 },
      ],
    },
    {
      taskTitle: 'Fix N+1 in task list endpoint',
      messages: [
        { author: 'dev2', body: '@dev1 the offender is the assignments lookup, not labels.' },
        { author: 'dev1', body: 'Confirmed. Adding a leftJoinAndSelect.' },
      ],
    },
    {
      taskTitle: 'Build kanban board UI',
      messages: [
        { author: 'pm', body: 'Let\'s match the wireframes in Figma exactly for v1.' },
        { author: 'dev2', body: 'Pushed a first pass to the branch.' },
        { author: 'admin', body: 'Looks great!' },
      ],
    },
    {
      taskTitle: 'Crash on attachment upload over 10MB',
      messages: [
        { author: 'dev1', body: 'Reproduced locally. The multer buffer was the issue.' },
        { author: 'dev1', body: 'Fix pushed — needs review.' },
      ],
    },
    {
      taskTitle: 'Production outage 2026-04-12',
      messages: [
        { author: 'admin', body: 'Postmortem doc is up.' },
        { author: 'pm', body: 'Thanks — sharing with the team.' },
      ],
    },
    {
      taskTitle: 'Webhook delivery retry queue',
      messages: [
        { author: 'dev1', body: 'Going with BullMQ here, consistent with the rest of the system.' },
        { author: 'admin', body: 'SGTM.' },
      ],
    },
    {
      taskTitle: 'Landing hero copy v2',
      messages: [
        { author: 'pm', body: 'Three variants drafted. Will pick one tomorrow.' },
        { author: 'admin', body: 'Variant B feels strongest.' },
        { author: 'pm', body: 'Same instinct, going with B.', replyIdx: 1 },
      ],
    },
    {
      taskTitle: 'Pricing page broken layout on mobile',
      messages: [
        { author: 'dev1', body: 'Only happens at <360px. CSS clamp() will fix it.' },
        { author: 'pm', body: 'Nice catch.' },
      ],
    },
  ];

  let count = 0;
  for (const t of threads) {
    const task = tasks.find((x) => x.title === t.taskTitle);
    if (!task) continue;
    const createdMsgs: Comment[] = [];
    for (let i = 0; i < t.messages.length; i++) {
      const m = t.messages[i];
      const parent = m.replyIdx !== undefined ? createdMsgs[m.replyIdx] : undefined;
      const existing = await repo.findOne({
        where: {
          workspaceId: workspace.id,
          contextType: CommentContext.TASK,
          contextId: task.id,
          authorUserId: users[m.author].id,
          body: m.body,
        },
      });
      if (existing) {
        createdMsgs.push(existing);
        continue;
      }
      const saved = await repo.save(
        repo.create({
          workspaceId: workspace.id,
          contextType: CommentContext.TASK,
          contextId: task.id,
          authorUserId: users[m.author].id,
          body: m.body,
          parentId: parent?.id ?? null,
        }),
      );
      createdMsgs.push(saved);
      count++;
    }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents (Wiki)
// ─────────────────────────────────────────────────────────────────────────────

interface DocSpec {
  title: string;
  text: string;
  icon?: string;
  creator: keyof SeededUsers;
  editor?: keyof SeededUsers;
  projectId?: string | null;
  childrenKey?: string; // group key for children below
  parentKey?: string;
  key: string;
}

async function seedDocuments(
  repo: Repo<DocumentEntity>,
  workspace: WorkspaceEntity,
  projects: SeededProjects,
  users: SeededUsers,
): Promise<number> {
  const docs: DocSpec[] = [
    { key: 'eng-handbook', title: 'Engineering Handbook', icon: 'book', text: 'The engineering team handbook. Conventions, processes, on-call.', creator: 'admin' },
    { key: 'platform-docs', title: 'Jitre Platform Docs', icon: 'rocket', text: 'Reference docs for the Jitre platform.', creator: 'admin', projectId: projects.platform.id },
    { key: 'marketing-playbook', title: 'Marketing Playbook', icon: 'megaphone', text: 'How we run marketing at Jitre.', creator: 'pm', projectId: projects.marketing.id },

    // Children of engineering handbook
    { key: 'coding-standards', parentKey: 'eng-handbook', title: 'Coding Standards', text: 'TypeScript strict mode, no `any`, conventional commits.', creator: 'admin', editor: 'dev1' },
    { key: 'git-workflow', parentKey: 'eng-handbook', title: 'Git Workflow', text: 'Trunk-based with short-lived feature branches and squash merges.', creator: 'dev1' },
    { key: 'oncall-runbook', parentKey: 'eng-handbook', title: 'On-call Runbook', text: 'Pager rotation, escalation paths, and dashboards.', creator: 'admin', editor: 'dev2' },

    // Children of platform docs
    { key: 'arch-overview', parentKey: 'platform-docs', title: 'Architecture Overview', text: 'NestJS modular monolith with BullMQ workers and Postgres.', creator: 'admin', projectId: projects.platform.id },
    { key: 'api-reference', parentKey: 'platform-docs', title: 'API Reference', text: 'OpenAPI spec at /api/docs. Authenticated with JWT.', creator: 'dev1', projectId: projects.platform.id },
    { key: 'api-endpoints', parentKey: 'api-reference', title: 'Endpoints', text: 'List of REST endpoints grouped by resource.', creator: 'dev1', editor: 'dev2', projectId: projects.platform.id },

    // Children of marketing playbook
    { key: 'brand-voice', parentKey: 'marketing-playbook', title: 'Brand Voice', text: 'Friendly, sharp, and never corporate.', creator: 'pm', projectId: projects.marketing.id },
    { key: 'campaign-templates', parentKey: 'marketing-playbook', title: 'Campaign Templates', text: 'Reusable templates for email, social and landing pages.', creator: 'pm', editor: 'admin', projectId: projects.marketing.id },
  ];

  let count = 0;
  const byKey = new Map<string, DocumentEntity>();
  // Persist in two passes so parents always exist first.
  const ordered = [...docs.filter((d) => !d.parentKey), ...docs.filter((d) => !!d.parentKey)];
  let order = 0;
  for (const d of ordered) {
    const parent = d.parentKey ? byKey.get(d.parentKey) : undefined;
    const existing = await repo.findOne({
      where: {
        workspaceId: workspace.id,
        title: d.title,
        parentId: parent?.id ?? (null as unknown as string),
      },
    });
    if (existing) {
      byKey.set(d.key, existing);
      continue;
    }
    const creator = users[d.creator];
    const editor = users[d.editor ?? d.creator];
    const saved = await repo.save(
      repo.create({
        workspaceId: workspace.id,
        projectId: d.projectId ?? null,
        parentId: parent?.id ?? null,
        title: d.title,
        icon: d.icon ?? null,
        content: { ops: [{ insert: `${d.text}\n` }] },
        contentText: d.text,
        order: order++,
        creatorUserId: creator.id,
        lastEditedByUserId: editor.id,
        lastEditedAt: daysAgo(Math.floor(Math.random() * 20) + 1),
      }),
    );
    byKey.set(d.key, saved);
    count++;
  }

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────────────────────

async function seedChat(
  channelRepo: Repo<ChatChannelEntity>,
  membershipRepo: Repository<ChatMembershipEntity>,
  messageRepo: Repo<ChatMessageEntity>,
  workspace: WorkspaceEntity,
  projects: SeededProjects,
  users: SeededUsers,
): Promise<{ channels: number; messages: number }> {
  async function ensureChannel(input: {
    name: string;
    description: string | null;
    type: 'public' | 'private' | 'dm';
    kind: ChatChannelKind;
    projectId?: string | null;
    createdBy: UserEntity;
    members: UserEntity[];
  }): Promise<{ channel: ChatChannelEntity; created: boolean }> {
    // Lookup strategy depends on what uniquely identifies the channel:
    //  - project channels: (workspaceId, projectId) — DB constraint
    //    `uq_chat_channels_project_channel` enforces 1 channel per project.
    //    Looking up by name would miss channels created with a previous name
    //    and cause an INSERT that crashes the unique constraint.
    //  - all other channels: (workspaceId, name, type).
    let channel = await channelRepo.findOne({
      where:
        input.projectId != null
          ? { workspaceId: workspace.id, projectId: input.projectId }
          : { workspaceId: workspace.id, name: input.name, type: input.type },
    });
    const created = !channel;
    if (!channel) {
      channel = await channelRepo.save(
        channelRepo.create({
          workspaceId: workspace.id,
          name: input.name,
          description: input.description,
          type: input.type,
          kind: input.kind,
          projectId: input.projectId ?? null,
          createdByUserId: input.createdBy.id,
          lastMessageAt: null,
        }),
      );
    } else {
      // Backfill metadata when an older row exists with stale name/kind/projectId.
      const patch: {
        kind?: ChatChannelKind;
        projectId?: string | null;
        name?: string;
        description?: string | null;
      } = {};
      if (channel.kind !== input.kind) patch.kind = input.kind;
      if ((channel.projectId ?? null) !== (input.projectId ?? null)) {
        patch.projectId = input.projectId ?? null;
      }
      if (channel.name !== input.name) patch.name = input.name;
      if ((channel.description ?? null) !== (input.description ?? null)) {
        patch.description = input.description ?? null;
      }
      if (Object.keys(patch).length > 0) {
        await channelRepo.update(channel.id, patch);
        Object.assign(channel, patch);
      }
    }
    for (const u of input.members) {
      const existing = await membershipRepo.findOne({
        where: { channelId: channel.id, userId: u.id },
      });
      if (!existing) {
        await membershipRepo.save(
          membershipRepo.create({
            channelId: channel.id,
            userId: u.id,
            notificationLevel: 'all',
            lastReadMessageId: null,
          }),
        );
      }
    }
    return { channel, created };
  }

  const allUsers = [users.admin, users.pm, users.dev1, users.dev2];

  const general = await ensureChannel({
    name: 'general',
    description: 'Everything else',
    type: 'public',
    kind: 'general',
    createdBy: users.admin,
    members: allUsers,
  });

  const engineering = await ensureChannel({
    name: 'engineering',
    description: 'Engineering discussions',
    type: 'public',
    kind: 'custom',
    createdBy: users.admin,
    members: [users.admin, users.pm, users.dev1, users.dev2],
  });

  const design = await ensureChannel({
    name: 'design',
    description: 'Design reviews and feedback',
    type: 'private',
    kind: 'custom',
    createdBy: users.pm,
    members: [users.admin, users.pm],
  });

  // Per-project channels (Fase 10 metadata)
  const platformChannel = await ensureChannel({
    name: 'proj-jitre-platform',
    description: 'Channel for the Jitre Platform project.',
    type: 'public',
    kind: 'project',
    projectId: projects.platform.id,
    createdBy: users.admin,
    members: [users.admin, users.pm, users.dev1, users.dev2],
  });

  const marketingChannel = await ensureChannel({
    name: 'proj-marketing-site',
    description: 'Channel for the Marketing Site project.',
    type: 'public',
    kind: 'project',
    projectId: projects.marketing.id,
    createdBy: users.pm,
    members: [users.admin, users.pm, users.dev1],
  });

  // DM admin ↔ dev1 — name is sorted id pair (stable, hidden in UI)
  const dmIds = [users.admin.id, users.dev1.id].sort();
  const dm = await ensureChannel({
    name: `dm:${dmIds.join('-')}`,
    description: null,
    type: 'dm',
    kind: 'dm',
    createdBy: users.admin,
    members: [users.admin, users.dev1],
  });

  const channelCount = [general, engineering, design, platformChannel, marketingChannel, dm].filter((c) => c.created).length;

  interface MsgSpec {
    author: keyof SeededUsers;
    body: string;
    daysAgo: number;
    replyIdx?: number;
  }
  const conversations: Array<{ channel: ChatChannelEntity; messages: MsgSpec[] }> = [
    {
      channel: general.channel,
      messages: [
        { author: 'admin', body: 'Welcome to Jitre Demo Co! :wave:', daysAgo: 6 },
        { author: 'pm', body: 'Glad to be here.', daysAgo: 6 },
        { author: 'dev1', body: 'Hi all!', daysAgo: 6 },
        { author: 'dev2', body: 'Excited to ship things.', daysAgo: 6 },
        { author: 'admin', body: 'All-hands tomorrow at 10am.', daysAgo: 2 },
        { author: 'pm', body: 'I\'ll send out the agenda this evening.', daysAgo: 2 },
        { author: 'dev1', body: 'Lunch?', daysAgo: 1 },
        { author: 'dev2', body: 'Always.', daysAgo: 1 },
        { author: 'admin', body: 'Good demo today, team.', daysAgo: 0 },
      ],
    },
    {
      channel: engineering.channel,
      messages: [
        { author: 'admin', body: 'Pinning the architecture doc here for new joiners.', daysAgo: 7 },
        { author: 'dev1', body: 'Question: should we cap concurrent BullMQ workers?', daysAgo: 5 },
        { author: 'admin', body: 'Yes — start with 4 per worker, monitor.', daysAgo: 5, replyIdx: 1 },
        { author: 'dev2', body: 'PR up for the kanban board — would love a review.', daysAgo: 4 },
        { author: 'dev1', body: 'Looking now.', daysAgo: 4, replyIdx: 3 },
        { author: 'pm', body: 'Reminder: code freeze Friday.', daysAgo: 3 },
        { author: 'dev1', body: 'Fixed the N+1 in task list.', daysAgo: 2 },
        { author: 'admin', body: 'Nice — how much did it shave off?', daysAgo: 2, replyIdx: 6 },
        { author: 'dev1', body: '~120ms p95.', daysAgo: 2, replyIdx: 6 },
        { author: 'dev2', body: 'Kanban DnD merged.', daysAgo: 1 },
        { author: 'admin', body: 'Tag a beta and ship it to staging.', daysAgo: 1, replyIdx: 9 },
        { author: 'dev2', body: 'On it.', daysAgo: 1, replyIdx: 9 },
        { author: 'dev1', body: 'Heads up: there\'s an intermittent test flake in jobs.spec.ts.', daysAgo: 0 },
      ],
    },
    {
      channel: design.channel,
      messages: [
        { author: 'pm', body: 'New brand palette is up.', daysAgo: 4 },
        { author: 'admin', body: 'The teal is great. Maybe darker for AA contrast?', daysAgo: 4 },
        { author: 'pm', body: 'Good call, will tweak.', daysAgo: 3 },
        { author: 'pm', body: 'Updated — should pass AAA on body text now.', daysAgo: 2 },
        { author: 'admin', body: 'Ship it.', daysAgo: 1 },
      ],
    },
    {
      channel: platformChannel.channel,
      messages: [
        { author: 'admin', body: 'Kicking off the Auth Hardening epic this sprint.', daysAgo: 6 },
        { author: 'dev1', body: 'I\'ll take JWT rotation. Should be done by Friday.', daysAgo: 5 },
        { author: 'dev2', body: 'Kanban board PR is up — needs a frontend reviewer.', daysAgo: 3 },
        { author: 'admin', body: 'On it.', daysAgo: 3, replyIdx: 2 },
        { author: 'dev2', body: 'Optimistic updates merged.', daysAgo: 1 },
      ],
    },
    {
      channel: marketingChannel.channel,
      messages: [
        { author: 'pm', body: 'Launch Day is locked in for end of month.', daysAgo: 4 },
        { author: 'pm', body: 'Hero copy variant B is the chosen one.', daysAgo: 2 },
        { author: 'dev1', body: 'Pricing page bug — fix incoming today.', daysAgo: 1 },
      ],
    },
    {
      channel: dm.channel,
      messages: [
        { author: 'admin', body: 'Got a sec to pair on the refresh-token rotation?', daysAgo: 3 },
        { author: 'dev1', body: 'Yep, 5min.', daysAgo: 3 },
        { author: 'admin', body: 'Thanks.', daysAgo: 3 },
        { author: 'dev1', body: 'That was helpful. PR incoming.', daysAgo: 2 },
        { author: 'admin', body: 'Will review tonight.', daysAgo: 2 },
        { author: 'dev1', body: 'Posted.', daysAgo: 1 },
        { author: 'admin', body: 'Reviewed — small nit, otherwise LGTM.', daysAgo: 0 },
        { author: 'dev1', body: 'Addressed, merging.', daysAgo: 0 },
      ],
    },
  ];

  let msgCount = 0;
  for (const conv of conversations) {
    const created: ChatMessageEntity[] = [];
    let lastMsgAt: Date | null = conv.channel.lastMessageAt;
    for (let i = 0; i < conv.messages.length; i++) {
      const m = conv.messages[i];
      const parent = m.replyIdx !== undefined ? created[m.replyIdx] : undefined;
      const ts = daysAgo(m.daysAgo);
      const existing = await messageRepo.findOne({
        where: {
          workspaceId: workspace.id,
          channelId: conv.channel.id,
          authorId: users[m.author].id,
          body: m.body,
        },
      });
      if (existing) {
        created.push(existing);
        if (!lastMsgAt || existing.createdAt > lastMsgAt) lastMsgAt = existing.createdAt;
        continue;
      }
      const saved = await messageRepo.save(
        messageRepo.create({
          workspaceId: workspace.id,
          channelId: conv.channel.id,
          authorId: users[m.author].id,
          body: m.body,
          parentMessageId: parent?.id ?? null,
          attachments: [],
          editedAt: null,
        }),
      );
      // Override createdAt to backdate.
      await messageRepo.update(saved.id, { createdAt: ts } as Partial<ChatMessageEntity>);
      saved.createdAt = ts;
      created.push(saved);
      msgCount++;
      if (!lastMsgAt || ts > lastMsgAt) lastMsgAt = ts;
    }
    if (lastMsgAt && (!conv.channel.lastMessageAt || lastMsgAt > conv.channel.lastMessageAt)) {
      await channelRepo.update(conv.channel.id, { lastMessageAt: lastMsgAt });
    }
  }

  return { channels: channelCount, messages: msgCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Time entries
// ─────────────────────────────────────────────────────────────────────────────

async function seedTimeEntries(
  repo: Repo<TimeEntryEntity>,
  workspace: WorkspaceEntity,
  tasks: TaskEntity[],
  users: SeededUsers,
): Promise<number> {
  if (tasks.length === 0) return 0;

  const userList = [users.admin, users.pm, users.dev1, users.dev2];
  // Deterministic-ish but varied. Bound to the dataset size so two runs
  // with the same data don't grow unbounded.
  const entrySpecs: Array<{
    userIdx: number;
    taskIdx: number;
    durationMinutes: number;
    dayOffset: number;
    billable: boolean;
    description: string | null;
    active?: boolean;
  }> = [];

  const durations = [30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 15, 75];
  for (let i = 0; i < 29; i++) {
    entrySpecs.push({
      userIdx: i % userList.length,
      taskIdx: i % tasks.length,
      durationMinutes: durations[i % durations.length],
      dayOffset: i % 14,
      billable: i % 5 !== 0,
      description: i % 3 === 0 ? `Focused work session ${i + 1}` : null,
    });
  }
  // Active timer (dev1, no stoppedAt)
  entrySpecs.push({
    userIdx: 2,
    taskIdx: 1,
    durationMinutes: 0,
    dayOffset: 0,
    billable: true,
    description: 'Live timer — debugging JWT refresh',
    active: true,
  });

  let count = 0;
  for (const spec of entrySpecs) {
    const user = userList[spec.userIdx];
    const task = tasks[spec.taskIdx];
    if (!task) continue;
    // Idempotency key: (userId, taskId, date, durationMinutes, description ?? '')
    const date = daysAgo(spec.dayOffset);
    const dateOnly = date.toISOString().slice(0, 10);
    const existing = await repo
      .createQueryBuilder('te')
      .where('te.workspaceId = :ws', { ws: workspace.id })
      .andWhere('te.userId = :uid', { uid: user.id })
      .andWhere('te.taskId = :tid', { tid: task.id })
      .andWhere('te.date = :d', { d: dateOnly })
      .andWhere('te.durationMinutes = :dur', { dur: spec.durationMinutes })
      .andWhere(
        spec.description ? 'te.description = :desc' : 'te.description IS NULL',
        spec.description ? { desc: spec.description } : {},
      )
      .getOne();
    if (existing) continue;

    const startedAt = spec.active ? new Date(Date.now() - 25 * 60_000) : null;
    const stoppedAt = spec.active ? null : null; // historical entries have no started/stopped

    await repo.save(
      repo.create({
        workspaceId: workspace.id,
        taskId: task.id,
        userId: user.id,
        durationMinutes: spec.durationMinutes,
        date,
        description: spec.description,
        billable: spec.billable,
        startedAt,
        stoppedAt,
      }),
    );
    count++;
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

async function seedNotifications(
  repo: Repo<Notification>,
  workspace: WorkspaceEntity,
  users: SeededUsers,
  tasks: TaskEntity[],
): Promise<number> {
  const taskRef = tasks[0]?.id ?? randomUUID();
  const taskTitle = tasks[0]?.title ?? 'A task';

  const specs: Array<{
    recipient: keyof SeededUsers;
    type: NotificationType;
    title: string;
    body: string;
    read: boolean;
    emailSent: boolean;
    daysAgo: number;
  }> = [
    // admin (4)
    { recipient: 'admin', type: NotificationType.WORKSPACE_INVITED, title: 'Welcome to Jitre Demo Co', body: 'Your workspace is ready.', read: true, emailSent: true, daysAgo: 12 },
    { recipient: 'admin', type: NotificationType.TASK_ASSIGNED, title: `Assigned: ${taskTitle}`, body: 'You were assigned a task.', read: false, emailSent: true, daysAgo: 2 },
    { recipient: 'admin', type: NotificationType.COMMENT_MENTIONED, title: 'Pat mentioned you', body: '@admin can you weigh in?', read: false, emailSent: false, daysAgo: 1 },
    { recipient: 'admin', type: NotificationType.TASK_DUE_SOON, title: 'Task due in 2 days', body: 'Production outage 2026-04-12', read: true, emailSent: true, daysAgo: 0 },

    // pm (3)
    { recipient: 'pm', type: NotificationType.WORKSPACE_INVITED, title: 'You\'ve been added to Jitre Demo Co', body: 'Welcome aboard.', read: true, emailSent: true, daysAgo: 12 },
    { recipient: 'pm', type: NotificationType.TASK_ASSIGNED, title: 'Assigned: Document API rate limits', body: 'Admin assigned this to you.', read: false, emailSent: false, daysAgo: 3 },
    { recipient: 'pm', type: NotificationType.TASK_COMMENTED, title: 'New comment on Landing hero copy v2', body: 'Variant B feels strongest.', read: false, emailSent: true, daysAgo: 1 },

    // dev1 (4)
    { recipient: 'dev1', type: NotificationType.WORKSPACE_INVITED, title: 'Welcome to Jitre Demo Co', body: 'You\'re in.', read: true, emailSent: true, daysAgo: 11 },
    { recipient: 'dev1', type: NotificationType.TASK_ASSIGNED, title: 'Assigned: Implement JWT refresh rotation', body: 'Admin assigned this to you.', read: true, emailSent: true, daysAgo: 5 },
    { recipient: 'dev1', type: NotificationType.COMMENT_MENTIONED, title: 'Sam mentioned you', body: '@dev1 the offender is the assignments lookup.', read: false, emailSent: false, daysAgo: 1 },
    { recipient: 'dev1', type: NotificationType.TASK_DUE_SOON, title: 'Task due tomorrow', body: 'Pricing page broken layout on mobile', read: false, emailSent: true, daysAgo: 0 },

    // dev2 (3)
    { recipient: 'dev2', type: NotificationType.WORKSPACE_INVITED, title: 'Welcome to Jitre Demo Co', body: 'You\'re in.', read: true, emailSent: true, daysAgo: 10 },
    { recipient: 'dev2', type: NotificationType.TASK_ASSIGNED, title: 'Assigned: Build kanban board UI', body: 'Admin assigned this to you.', read: true, emailSent: true, daysAgo: 4 },
    { recipient: 'dev2', type: NotificationType.TASK_STATUS_CHANGED, title: 'Login form double-submit bug → In Progress', body: 'Status changed.', read: false, emailSent: false, daysAgo: 0 },
  ];

  let count = 0;
  for (const s of specs) {
    const recipient = users[s.recipient];
    const existing = await repo.findOne({
      where: {
        workspaceId: workspace.id,
        recipientUserId: recipient.id,
        type: s.type,
        title: s.title,
      },
    });
    if (existing) continue;
    const ts = daysAgo(s.daysAgo);
    await repo.save(
      repo.create({
        workspaceId: workspace.id,
        recipientUserId: recipient.id,
        type: s.type,
        title: s.title,
        body: s.body,
        data: { taskId: taskRef },
        readAt: s.read ? ts : null,
        priority: 'normal',
        occurredAt: ts,
        emailSentAt: s.emailSent ? ts : null,
      }),
    );
    count++;
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const ds = await AppDataSource.initialize();
  console.log('Connected to database. Seeding…\n');

  try {
    const users = await seedUsers(ds.getRepository(UserEntity));
    const workspace = await seedWorkspace(ds.getRepository(WorkspaceEntity), users.admin);
    await seedWorkspaceMemberships(ds.getRepository(WorkspaceMembershipEntity), workspace, users);

    const projects = await seedProjects(ds.getRepository(ProjectEntity), workspace, users);
    await seedProjectMemberships(
      ds.getRepository(ProjectMembershipEntity),
      workspace,
      projects,
      users,
    );

    const statuses = await seedStatuses(ds.getRepository(StatusEntity), workspace, projects);
    const labels = await seedLabels(ds.getRepository(LabelEntity), workspace, projects);
    const planning = await seedPlanningItems(
      ds.getRepository(PlanningItemEntity),
      workspace,
      projects,
    );

    const tasksRepo = ds.getRepository(TaskEntity);
    await seedTasks(
      tasksRepo,
      ds.getRepository(TaskAssignmentEntity),
      ds.getRepository(TaskLabelEntity),
      workspace,
      projects,
      statuses,
      labels,
      planning,
      users,
    );
    const allTasks = await tasksRepo.find({ where: { workspaceId: workspace.id } });

    const commentCount = await seedComments(
      ds.getRepository(Comment),
      workspace,
      allTasks,
      users,
    );

    const docCount = await seedDocuments(
      ds.getRepository(DocumentEntity),
      workspace,
      projects,
      users,
    );

    const chatRes = await seedChat(
      ds.getRepository(ChatChannelEntity),
      ds.getRepository(ChatMembershipEntity),
      ds.getRepository(ChatMessageEntity),
      workspace,
      projects,
      users,
    );

    const timeCount = await seedTimeEntries(
      ds.getRepository(TimeEntryEntity),
      workspace,
      allTasks,
      users,
    );

    const notifCount = await seedNotifications(
      ds.getRepository(Notification),
      workspace,
      users,
      allTasks,
    );

    // ────────────────────────────────────────────────────────────
    // AI prompt templates — built-in library
    // ────────────────────────────────────────────────────────────
    const promptTemplateRepo = AppDataSource.getRepository(AiPromptTemplateEntity);
    let templatesInserted = 0;
    for (const tpl of BUILTIN_PROMPT_TEMPLATES) {
      const exists = await promptTemplateRepo.findOne({
        where: {
          workspaceId: workspace.id,
          operation: tpl.operation,
          name: tpl.name,
        },
      });
      if (exists) continue;
      await promptTemplateRepo.save(
        promptTemplateRepo.create({
          workspaceId: workspace.id,
          operation: tpl.operation,
          name: tpl.name,
          description: tpl.description,
          systemPrompt: tpl.systemPrompt,
          userTemplate: tpl.userTemplate,
          variables: tpl.variables,
          isDefault: tpl.isInitialDefault,
          isBuiltin: true,
          createdByUserId: null,
        }),
      );
      templatesInserted++;
    }

    // Final counts (read after the fact so re-runs print accurate totals)
    const totalStatuses =
      (statuses.byProject.get(projects.platform.id)?.length ?? 0) +
      (statuses.byProject.get(projects.marketing.id)?.length ?? 0);
    const totalLabels =
      (labels.byProject.get(projects.platform.id)?.length ?? 0) +
      (labels.byProject.get(projects.marketing.id)?.length ?? 0);
    const totalPlanning = (() => {
      let n = 0;
      for (const group of planning.byProject.values()) {
        n += group.epics.size + group.sprints.size + group.releases.size;
      }
      return n;
    })();

    console.log('✓ Seed complete');
    console.log('─'.repeat(45));
    console.log(`Workspace: ${workspace.name} (slug: ${workspace.slug})`);
    console.log('');
    console.log('Login credentials:');
    console.log('  admin@jitre.test / admin123  (Owner)');
    console.log('  pm@jitre.test    / pm123     (Admin)');
    console.log('  dev1@jitre.test  / dev123    (Member, has active timer)');
    console.log('  dev2@jitre.test  / dev123    (Member)');
    console.log('');
    console.log('Data created (or already present):');
    console.log(`  • 2 projects (with issue keys JIT-* and MKT-*)`);
    console.log(`  • ${totalStatuses} workflow statuses (custom per project)`);
    console.log(`  • ${totalLabels} labels`);
    console.log(`  • ${totalPlanning} planning items (epics, sprints, releases)`);
    console.log(`  • ${allTasks.length} tasks (assignees, labels, subtasks, planning links)`);
    console.log(`  • ${docCount} new documents this run (hierarchical wiki)`);
    console.log(`  • ${chatRes.channels} new chat channels this run (general + 2 custom + 2 project + 1 DM total)`);
    console.log(`  • ${chatRes.messages} new chat messages this run`);
    console.log(`  • ${timeCount} new time entries this run (1 active timer)`);
    console.log(`  • ${notifCount} new notifications this run`);
    console.log(`  • ${templatesInserted} AI prompt templates inserted (built-in library)`);
    console.log(`  • ${commentCount} new comments this run`);
    console.log('─'.repeat(45));
  } finally {
    await AppDataSource.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('\nSeed failed:');
    console.error(err);
    void AppDataSource.destroy().catch(() => undefined);
    process.exit(1);
  });
