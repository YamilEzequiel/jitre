import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { WorkspaceService } from './workspace.service';
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

const savedWorkspace = {
  id: 'ws-1',
  name: 'Test WS',
  slug: 'test-ws',
  ownerId: 'user-1',
};
const savedMembership = {
  id: 'm1',
  userId: 'user-1',
  workspaceId: 'ws-1',
  role: WorkspaceRole.OWNER,
};

const mockEntityManager = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  softDelete: jest.fn(),
};

const mockDataSource = {
  transaction: jest
    .fn()
    .mockImplementation((cb: (em: typeof mockEntityManager) => unknown) =>
      cb(mockEntityManager),
    ),
};

const mockWsRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockMemberRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  softDelete: jest.fn(),
};

const mockEventBus = {
  publish: jest.fn(),
};

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: getRepositoryToken(WorkspaceEntity), useValue: mockWsRepo },
        {
          provide: getRepositoryToken(WorkspaceMembershipEntity),
          useValue: mockMemberRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  describe('create', () => {
    it('should create workspace and OWNER membership in a transaction', async () => {
      mockEntityManager.create.mockImplementation(
        (entity: unknown, data: unknown) => data,
      );
      mockEntityManager.save.mockImplementation(
        (entity: unknown, data: unknown) => {
          if ((data as { name?: string }).name)
            return Promise.resolve(savedWorkspace);
          return Promise.resolve(savedMembership);
        },
      );
      mockEntityManager.findOne.mockResolvedValue(null);

      const result = await service.create('user-1', {
        name: 'Test WS',
        slug: 'test-ws',
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result).toEqual(savedWorkspace);

      const publishCalls = mockEventBus.publish.mock.calls;
      const publishedNames = publishCalls.map(
        ([event]: [{ name: string }]) => event.name,
      );
      expect(publishedNames).toContain('workspace.created');
      expect(publishedNames).toContain('workspace.member.added');

      const wsCreated = publishCalls.find(
        ([e]: [WorkspaceCreatedEvent]) => e instanceof WorkspaceCreatedEvent,
      )?.[0] as WorkspaceCreatedEvent;
      expect(wsCreated).toBeDefined();
      expect(wsCreated.aggregateId).toBe('ws-1');
      expect(wsCreated.workspaceId).toBe('ws-1');
      expect(wsCreated.payload.name).toBe('Test WS');

      const memberAdded = publishCalls.find(
        ([e]: [WorkspaceMemberAddedEvent]) =>
          e instanceof WorkspaceMemberAddedEvent,
      )?.[0] as WorkspaceMemberAddedEvent;
      expect(memberAdded).toBeDefined();
      expect(memberAdded.payload.role).toBe(WorkspaceRole.OWNER);
    });

    it('should auto-generate slug when not provided', async () => {
      mockEntityManager.create.mockImplementation(
        (entity: unknown, data: unknown) => data,
      );
      mockEntityManager.save.mockImplementation(
        (entity: unknown, data: unknown) => {
          if ((data as { name?: string }).name)
            return Promise.resolve(savedWorkspace);
          return Promise.resolve(savedMembership);
        },
      );
      mockEntityManager.findOne.mockResolvedValue(null);

      const result = await service.create('user-1', { name: 'My Workspace' });
      expect(result).toBeDefined();
    });
  });

  describe('listForUser', () => {
    it('should return workspaces where user has membership', async () => {
      const workspaces = [savedWorkspace];
      mockWsRepo.find.mockResolvedValue(workspaces);
      const result = await service.listForUser('user-1');
      expect(result).toEqual(workspaces);
    });
  });

  describe('findMembership', () => {
    it('should return the membership when found', async () => {
      mockMemberRepo.findOne.mockResolvedValue(savedMembership);
      const result = await service.findMembership('user-1', 'ws-1');
      expect(result).toEqual(savedMembership);
    });

    it('should return null when no membership', async () => {
      mockMemberRepo.findOne.mockResolvedValue(null);
      const result = await service.findMembership('user-1', 'ws-999');
      expect(result).toBeNull();
    });
  });

  describe('listContacts', () => {
    it('returns safe user profile fields for workspace messaging', async () => {
      mockMemberRepo.find.mockResolvedValue([
        {
          userId: 'user-2',
          workspaceId: 'ws-1',
          role: WorkspaceRole.MEMBER,
          user: {
            displayName: 'Maya',
            email: 'maya@example.com',
            avatarUrl: null,
            passwordHash: 'never-expose',
          },
        },
      ]);

      const result = await service.listContacts('ws-1');

      expect(mockMemberRepo.find).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', deletedAt: IsNull() },
        relations: { user: true },
      });
      expect(result).toEqual([
        {
          userId: 'user-2',
          displayName: 'Maya',
          email: 'maya@example.com',
          avatarUrl: null,
          role: WorkspaceRole.MEMBER,
        },
      ]);
      expect(result[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('addMember', () => {
    it('should add a member successfully and emit WorkspaceMemberAddedEvent', async () => {
      mockMemberRepo.findOne.mockResolvedValue(null);
      const newMembership = {
        id: 'm2',
        userId: 'user-2',
        workspaceId: 'ws-1',
        role: WorkspaceRole.MEMBER,
      };
      mockMemberRepo.create.mockReturnValue(newMembership);
      mockMemberRepo.save.mockResolvedValue(newMembership);

      const result = await service.addMember('ws-1', {
        userId: 'user-2',
        role: WorkspaceRole.MEMBER,
        actorUserId: 'user-1',
      });
      expect(result).toEqual(newMembership);

      const memberAdded = mockEventBus.publish.mock.calls.find(
        ([e]: [WorkspaceMemberAddedEvent]) =>
          e instanceof WorkspaceMemberAddedEvent,
      )?.[0] as WorkspaceMemberAddedEvent;
      expect(memberAdded).toBeDefined();
      expect(memberAdded.payload.addedUserId).toBe('user-2');
      expect(memberAdded.workspaceId).toBe('ws-1');
    });

    it('should throw ConflictException if already a member', async () => {
      mockMemberRepo.findOne.mockResolvedValue(savedMembership);
      await expect(
        service.addMember('ws-1', {
          userId: 'user-1',
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeMember', () => {
    it('should remove a non-owner member and emit WorkspaceMemberRemovedEvent', async () => {
      const memberMembership = {
        id: 'm2',
        userId: 'user-2',
        workspaceId: 'ws-1',
        role: WorkspaceRole.MEMBER,
      };
      mockDataSource.transaction.mockImplementation(
        (cb: (em: typeof mockEntityManager) => unknown) =>
          cb(mockEntityManager),
      );
      mockEntityManager.findOne.mockResolvedValue(memberMembership);
      mockEntityManager.count.mockResolvedValue(1); // still 1 owner after removal
      mockEntityManager.softDelete.mockResolvedValue({ affected: 1 });

      await service.removeMember('ws-1', 'user-2');
      expect(mockEntityManager.softDelete).toHaveBeenCalled();

      const removedEvent = mockEventBus.publish.mock.calls.find(
        ([e]: [WorkspaceMemberRemovedEvent]) =>
          e instanceof WorkspaceMemberRemovedEvent,
      )?.[0] as WorkspaceMemberRemovedEvent;
      expect(removedEvent).toBeDefined();
      expect(removedEvent.payload.removedUserId).toBe('user-2');
      expect(removedEvent.payload.previousRole).toBe(WorkspaceRole.MEMBER);
    });

    it('should throw ConflictException when removing the last OWNER', async () => {
      const ownerMembership = {
        id: 'm1',
        userId: 'user-1',
        workspaceId: 'ws-1',
        role: WorkspaceRole.OWNER,
      };
      mockDataSource.transaction.mockImplementation(
        (cb: (em: typeof mockEntityManager) => unknown) =>
          cb(mockEntityManager),
      );
      mockEntityManager.findOne.mockResolvedValue(ownerMembership);
      mockEntityManager.count.mockResolvedValue(0); // would leave 0 owners

      await expect(service.removeMember('ws-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateMemberRole', () => {
    const ownerActorRole = WorkspaceRole.OWNER;
    const adminActorRole = WorkspaceRole.ADMIN;

    it('throws ForbiddenException(CANNOT_CHANGE_OWN_ROLE) when actor edits themselves', async () => {
      await expect(
        service.updateMemberRole(
          'ws-1',
          'user-1',
          WorkspaceRole.MEMBER,
          'user-1',
          ownerActorRole,
        ),
      ).rejects.toThrow(
        new ForbiddenException('CANNOT_CHANGE_OWN_ROLE'),
      );
      expect(mockMemberRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException(MEMBER_NOT_FOUND) when membership does not exist', async () => {
      mockMemberRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateMemberRole(
          'ws-1',
          'user-missing',
          WorkspaceRole.MEMBER,
          'actor-1',
          ownerActorRole,
        ),
      ).rejects.toThrow(new NotFoundException('MEMBER_NOT_FOUND'));
    });

    it('throws ForbiddenException(OWNER_REQUIRED) when a non-OWNER tries to promote to OWNER', async () => {
      mockMemberRepo.findOne.mockResolvedValue({
        id: 'm2',
        userId: 'user-2',
        workspaceId: 'ws-1',
        role: WorkspaceRole.MEMBER,
      });
      await expect(
        service.updateMemberRole(
          'ws-1',
          'user-2',
          WorkspaceRole.OWNER,
          'actor-1',
          adminActorRole,
        ),
      ).rejects.toThrow(new ForbiddenException('OWNER_REQUIRED'));
    });

    it('throws ForbiddenException(OWNER_REQUIRED) when a non-OWNER tries to demote an OWNER', async () => {
      mockMemberRepo.findOne.mockResolvedValue({
        id: 'm2',
        userId: 'user-2',
        workspaceId: 'ws-1',
        role: WorkspaceRole.OWNER,
      });
      await expect(
        service.updateMemberRole(
          'ws-1',
          'user-2',
          WorkspaceRole.ADMIN,
          'actor-1',
          adminActorRole,
        ),
      ).rejects.toThrow(new ForbiddenException('OWNER_REQUIRED'));
    });

    it('throws ConflictException(LAST_OWNER) when demoting the only remaining OWNER', async () => {
      mockMemberRepo.findOne.mockResolvedValue({
        id: 'm2',
        userId: 'user-2',
        workspaceId: 'ws-1',
        role: WorkspaceRole.OWNER,
      });
      mockMemberRepo.count.mockResolvedValue(0); // no other OWNERs

      await expect(
        service.updateMemberRole(
          'ws-1',
          'user-2',
          WorkspaceRole.MEMBER,
          'actor-1',
          ownerActorRole,
        ),
      ).rejects.toThrow(new ConflictException('LAST_OWNER'));
      expect(mockMemberRepo.save).not.toHaveBeenCalled();
    });

    it('allows OWNER demotion when other OWNERs remain', async () => {
      const membership = {
        id: 'm2',
        userId: 'user-2',
        workspaceId: 'ws-1',
        role: WorkspaceRole.OWNER,
      };
      mockMemberRepo.findOne.mockResolvedValue(membership);
      mockMemberRepo.count.mockResolvedValue(1); // one OWNER remaining
      mockMemberRepo.save.mockImplementation((m: unknown) =>
        Promise.resolve(m),
      );

      const result = await service.updateMemberRole(
        'ws-1',
        'user-2',
        WorkspaceRole.ADMIN,
        'actor-1',
        ownerActorRole,
      );

      expect(result.role).toBe(WorkspaceRole.ADMIN);
      expect(mockMemberRepo.save).toHaveBeenCalled();

      const event = mockEventBus.publish.mock.calls.find(
        ([e]: [WorkspaceMemberRoleChangedEvent]) =>
          e instanceof WorkspaceMemberRoleChangedEvent,
      )?.[0] as WorkspaceMemberRoleChangedEvent;
      expect(event).toBeDefined();
      expect(event.payload.previousRole).toBe(WorkspaceRole.OWNER);
      expect(event.payload.newRole).toBe(WorkspaceRole.ADMIN);
      expect(event.payload.targetUserId).toBe('user-2');
      expect(event.actorUserId).toBe('actor-1');
    });

    it('lets an ADMIN promote a MEMBER to ADMIN and emits the role-changed event', async () => {
      const membership = {
        id: 'm2',
        userId: 'user-2',
        workspaceId: 'ws-1',
        role: WorkspaceRole.MEMBER,
      };
      mockMemberRepo.findOne.mockResolvedValue(membership);
      mockMemberRepo.save.mockImplementation((m: unknown) =>
        Promise.resolve(m),
      );

      const result = await service.updateMemberRole(
        'ws-1',
        'user-2',
        WorkspaceRole.ADMIN,
        'actor-1',
        adminActorRole,
      );

      expect(result.role).toBe(WorkspaceRole.ADMIN);

      const event = mockEventBus.publish.mock.calls.find(
        ([e]: [WorkspaceMemberRoleChangedEvent]) =>
          e instanceof WorkspaceMemberRoleChangedEvent,
      )?.[0] as WorkspaceMemberRoleChangedEvent;
      expect(event).toBeDefined();
      expect(event.payload.previousRole).toBe(WorkspaceRole.MEMBER);
      expect(event.payload.newRole).toBe(WorkspaceRole.ADMIN);
    });

    it('returns the membership unchanged when newRole equals previousRole', async () => {
      const membership = {
        id: 'm2',
        userId: 'user-2',
        workspaceId: 'ws-1',
        role: WorkspaceRole.MEMBER,
      };
      mockMemberRepo.findOne.mockResolvedValue(membership);

      const result = await service.updateMemberRole(
        'ws-1',
        'user-2',
        WorkspaceRole.MEMBER,
        'actor-1',
        adminActorRole,
      );

      expect(result).toBe(membership);
      expect(mockMemberRepo.save).not.toHaveBeenCalled();
      const roleChangedEvent = mockEventBus.publish.mock.calls.find(
        ([e]: [WorkspaceMemberRoleChangedEvent]) =>
          e instanceof WorkspaceMemberRoleChangedEvent,
      );
      expect(roleChangedEvent).toBeUndefined();
    });
  });

  describe('slug generation', () => {
    it('should slugify the workspace name', async () => {
      mockEntityManager.create.mockImplementation(
        (entity: unknown, data: unknown) => data,
      );
      mockEntityManager.save.mockImplementation(
        (entity: unknown, data: unknown) => {
          if ((data as { name?: string }).name)
            return Promise.resolve({ ...(data as object), id: 'ws-2' });
          return Promise.resolve(savedMembership);
        },
      );
      mockEntityManager.findOne.mockResolvedValue(null);

      const result = await service.create('user-1', {
        name: 'My Cool Workspace',
      });
      expect(result).toBeDefined();
    });

    it('should throw if all 100 slug attempts are taken', async () => {
      mockEntityManager.create.mockImplementation(
        (entity: unknown, data: unknown) => data,
      );
      mockEntityManager.findOne.mockResolvedValue({ id: 'existing' }); // always taken

      await expect(
        service.create('user-1', { name: 'Same Name' }),
      ).rejects.toThrow();
    });
  });
});
