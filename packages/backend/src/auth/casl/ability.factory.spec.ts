import { Test, TestingModule } from '@nestjs/testing';
import { CaslAbilityFactory } from './ability.factory';
import { WorkspaceRole } from '@jitre/shared';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaslAbilityFactory],
    }).compile();

    factory = module.get<CaslAbilityFactory>(CaslAbilityFactory);
  });

  const userId = 'user-1';
  const workspaceId = 'ws-1';

  describe('OWNER role', () => {
    it('should allow manage on all subjects', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.OWNER,
      );
      expect(ability.can('manage', 'all')).toBe(true);
    });

    it('should allow transfer on Workspace', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.OWNER,
      );
      expect(ability.can('transfer', 'Workspace')).toBe(true);
    });

    it('should allow delete on Workspace', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.OWNER,
      );
      expect(ability.can('delete', 'Workspace')).toBe(true);
    });
  });

  describe('ADMIN role', () => {
    it('should allow manage on all subjects', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.ADMIN,
      );
      expect(ability.can('manage', 'all')).toBe(true);
    });

    it('should NOT allow transfer on Workspace', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.ADMIN,
      );
      expect(ability.cannot('transfer', 'Workspace')).toBe(true);
    });

    it('should NOT allow delete on Workspace', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.ADMIN,
      );
      expect(ability.cannot('delete', 'Workspace')).toBe(true);
    });
  });

  describe('MEMBER role', () => {
    it('should allow read on all subjects', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.MEMBER,
      );
      expect(ability.can('read', 'all')).toBe(true);
    });

    it('should allow create on all subjects', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.MEMBER,
      );
      expect(ability.can('create', 'all')).toBe(true);
    });

    it('should NOT allow manage on all subjects', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.MEMBER,
      );
      expect(ability.cannot('manage', 'all')).toBe(true);
    });
  });

  describe('GUEST role', () => {
    it('should allow read on all subjects', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.GUEST,
      );
      expect(ability.can('read', 'all')).toBe(true);
    });

    it('should NOT allow create on any subject', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.GUEST,
      );
      expect(ability.cannot('create', 'all')).toBe(true);
    });

    it('should NOT allow manage on any subject', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.GUEST,
      );
      expect(ability.cannot('manage', 'all')).toBe(true);
    });
  });

  // ── I1/I2 — AI CASL extensions (Fase 7) ──────────────────────────────────

  describe('MEMBER role — use_ai (I2)', () => {
    it('grants use_ai on Workspace for MEMBER', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.MEMBER,
      );
      expect(ability.can('use_ai', 'Workspace')).toBe(true);
    });

    it('does NOT grant manage_ai_settings on Workspace for MEMBER', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.MEMBER,
      );
      expect(ability.cannot('manage_ai_settings', 'Workspace')).toBe(true);
    });
  });

  describe('ADMIN role — use_ai + manage_ai_settings (I2)', () => {
    it('grants use_ai on Workspace for ADMIN', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.ADMIN,
      );
      expect(ability.can('use_ai', 'Workspace')).toBe(true);
    });

    it('grants manage_ai_settings on Workspace for ADMIN', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.ADMIN,
      );
      expect(ability.can('manage_ai_settings', 'Workspace')).toBe(true);
    });

    it('grants read on AiUsageRecord for ADMIN', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.ADMIN,
      );
      expect(ability.can('read', 'AiUsageRecord')).toBe(true);
    });
  });

  describe('GUEST role — no AI abilities (I2)', () => {
    it('does NOT grant use_ai for GUEST', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.GUEST,
      );
      expect(ability.cannot('use_ai', 'Workspace')).toBe(true);
    });
  });

  describe('TimeEntry (Fase 10)', () => {
    it('grants full TimeEntry management to ADMIN', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.ADMIN,
      );
      expect(ability.can('manage', 'TimeEntry')).toBe(true);
      expect(ability.can('read', 'TimeEntry')).toBe(true);
      expect(ability.can('create', 'TimeEntry')).toBe(true);
      expect(ability.can('update', 'TimeEntry')).toBe(true);
      expect(ability.can('delete', 'TimeEntry')).toBe(true);
    });

    it('grants full TimeEntry management to OWNER', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.OWNER,
      );
      expect(ability.can('manage', 'TimeEntry')).toBe(true);
    });

    it('lets MEMBER create their own TimeEntry', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.MEMBER,
      );
      expect(ability.can('create', 'TimeEntry')).toBe(true);
    });

    it('GUEST cannot create TimeEntry', () => {
      const ability = factory.createForUserInWorkspace(
        userId,
        workspaceId,
        WorkspaceRole.GUEST,
      );
      expect(ability.cannot('create', 'TimeEntry')).toBe(true);
      expect(ability.cannot('update', 'TimeEntry')).toBe(true);
      expect(ability.cannot('delete', 'TimeEntry')).toBe(true);
    });
  });
});
