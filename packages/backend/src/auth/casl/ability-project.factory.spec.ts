import { Test, TestingModule } from '@nestjs/testing';
import { CaslAbilityFactory } from './ability.factory';
import { WorkspaceRole, ProjectRole } from '@jitre/shared';

describe('CaslAbilityFactory — createForUserInProject', () => {
  let factory: CaslAbilityFactory;

  const userId = 'user-1';
  const workspaceId = 'ws-1';
  const projectId = 'proj-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaslAbilityFactory],
    }).compile();
    factory = module.get<CaslAbilityFactory>(CaslAbilityFactory);
  });

  describe('workspace OWNER always wins', () => {
    it('can manage all regardless of projectRole', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.OWNER,
        undefined,
      );
      expect(ability.can('manage', 'all')).toBe(true);
    });
  });

  describe('workspace ADMIN always wins', () => {
    it('can manage all regardless of projectRole', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.ADMIN,
        undefined,
      );
      expect(ability.can('manage', 'all')).toBe(true);
    });
  });

  describe('project ADMIN role', () => {
    it('can manage_members', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.ADMIN,
      );
      expect(ability.can('manage_members', 'Project')).toBe(true);
    });

    it('can manage Task', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.ADMIN,
      );
      expect(ability.can('manage', 'Task')).toBe(true);
    });

    it('can manage Status', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.ADMIN,
      );
      expect(ability.can('manage', 'Status')).toBe(true);
    });

    it('can manage Label', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.ADMIN,
      );
      expect(ability.can('manage', 'Label')).toBe(true);
    });

    it('can manage CustomField', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.ADMIN,
      );
      expect(ability.can('manage', 'CustomField')).toBe(true);
    });

    it('can manage ProjectMembership', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.ADMIN,
      );
      expect(ability.can('manage', 'ProjectMembership')).toBe(true);
    });
  });

  describe('project CONTRIBUTOR role', () => {
    it('can create Task', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.CONTRIBUTOR,
      );
      expect(ability.can('create', 'Task')).toBe(true);
    });

    it('can read Task', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.CONTRIBUTOR,
      );
      expect(ability.can('read', 'Task')).toBe(true);
    });

    it('cannot manage_members', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.CONTRIBUTOR,
      );
      expect(ability.cannot('manage_members', 'Project')).toBe(true);
    });

    it('cannot manage Task (admin-level)', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.CONTRIBUTOR,
      );
      expect(ability.cannot('manage', 'Task')).toBe(true);
    });
  });

  describe('project VIEWER role', () => {
    it('can read Task', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.VIEWER,
      );
      expect(ability.can('read', 'Task')).toBe(true);
    });

    it('cannot create Task', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.VIEWER,
      );
      expect(ability.cannot('create', 'Task')).toBe(true);
    });

    it('cannot manage_members', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.VIEWER,
      );
      expect(ability.cannot('manage_members', 'Project')).toBe(true);
    });
  });

  // ── K2: V4 fix — CONTRIBUTOR own-task scoping ─────────────────────────────

  describe('project CONTRIBUTOR own-task scoping (V4)', () => {
    it('can update own task (creatorUserId matches)', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.CONTRIBUTOR,
      );
      // Own task: creatorUserId === userId
      expect(
        ability.can('update', {
          constructor: { name: 'Task' },
          creatorUserId: userId,
        }),
      ).toBe(true);
    });

    it('cannot update another user task', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.CONTRIBUTOR,
      );
      // Other task: creatorUserId !== userId
      expect(
        ability.cannot('update', {
          constructor: { name: 'Task' },
          creatorUserId: 'other-user',
        }),
      ).toBe(true);
    });

    it('can delete own task', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.CONTRIBUTOR,
      );
      expect(
        ability.can('delete', {
          constructor: { name: 'Task' },
          creatorUserId: userId,
        }),
      ).toBe(true);
    });

    it('cannot delete another user task', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        ProjectRole.CONTRIBUTOR,
      );
      expect(
        ability.cannot('delete', {
          constructor: { name: 'Task' },
          creatorUserId: 'other-user',
        }),
      ).toBe(true);
    });
  });

  describe('no project membership', () => {
    it('cannot create Task', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        undefined,
      );
      expect(ability.cannot('create', 'Task')).toBe(true);
    });

    it('cannot read Task', () => {
      const ability = factory.createForUserInProject(
        userId,
        workspaceId,
        projectId,
        WorkspaceRole.MEMBER,
        undefined,
      );
      expect(ability.cannot('read', 'Task')).toBe(true);
    });
  });
});
