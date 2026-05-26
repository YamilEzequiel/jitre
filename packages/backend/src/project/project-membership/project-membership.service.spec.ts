import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectMembershipService } from './project-membership.service';
import { ProjectMembershipEntity } from './project-membership.entity';
import { ProjectRole } from '@jitre/shared';
import {
  ProjectMemberAddedEvent,
  ProjectMemberRemovedEvent,
  ProjectMemberRoleChangedEvent,
} from '../events';

const WS = 'ws-1';
const PROJECT = 'proj-1';
const USER = 'user-1';

const makeMembership = (
  overrides: Partial<ProjectMembershipEntity> = {},
): ProjectMembershipEntity =>
  ({
    id: 'm1',
    workspaceId: WS,
    projectId: PROJECT,
    userId: USER,
    role: ProjectRole.ADMIN,
    assignedAt: new Date(),
    ...overrides,
  }) as unknown as ProjectMembershipEntity;

describe('ProjectMembershipService', () => {
  let service: ProjectMembershipService;
  let memberRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  let chatService: {
    getProjectChannel: jest.Mock;
    addMember: jest.Mock;
    removeMember: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    memberRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };
    chatService = {
      getProjectChannel: jest.fn().mockResolvedValue({ id: 'chat-proj-1' }),
      addMember: jest.fn().mockResolvedValue({}),
      removeMember: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = { publish: jest.fn() };

    service = new ProjectMembershipService(
      memberRepo as never,
      chatService as never,
      eventBus as never,
    );
  });

  describe('addMember', () => {
    it('creates a new membership and emits ProjectMemberAddedEvent', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      const newMember = makeMembership({ role: ProjectRole.CONTRIBUTOR });
      memberRepo.create.mockReturnValue(newMember);
      memberRepo.save.mockResolvedValue(newMember);

      await service.addMember(
        PROJECT,
        WS,
        USER,
        ProjectRole.CONTRIBUTOR,
        'actor-1',
      );

      expect(memberRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(ProjectMemberAddedEvent);
      expect(event.payload.userId).toBe(USER);
      expect(event.payload.role).toBe(ProjectRole.CONTRIBUTOR);
      expect(chatService.addMember).toHaveBeenCalledWith(
        'chat-proj-1',
        WS,
        USER,
      );
    });

    it('updates role if membership already exists (idempotent)', async () => {
      const existing = makeMembership({ role: ProjectRole.VIEWER });
      memberRepo.findOne.mockResolvedValue(existing);
      memberRepo.save.mockResolvedValue({
        ...existing,
        role: ProjectRole.CONTRIBUTOR,
      });

      await service.addMember(
        PROJECT,
        WS,
        USER,
        ProjectRole.CONTRIBUTOR,
        'actor-1',
      );

      expect(memberRepo.save).toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('removes membership and emits ProjectMemberRemovedEvent', async () => {
      const existing = makeMembership({ role: ProjectRole.CONTRIBUTOR });
      memberRepo.findOne.mockResolvedValue(existing);
      // Admin count: 1 admin remains after removing a contributor
      memberRepo.count.mockResolvedValue(1);
      memberRepo.delete.mockResolvedValue({ affected: 1 });

      await service.removeMember(PROJECT, WS, USER, 'actor-1');

      expect(memberRepo.delete).toHaveBeenCalled();
      expect(chatService.removeMember).toHaveBeenCalledWith(
        'chat-proj-1',
        WS,
        USER,
      );
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(ProjectMemberRemovedEvent);
    });

    it('throws ConflictException when removing the last ADMIN', async () => {
      const existing = makeMembership({ role: ProjectRole.ADMIN });
      memberRepo.findOne.mockResolvedValue(existing);
      memberRepo.count.mockResolvedValue(1); // only 1 admin

      await expect(
        service.removeMember(PROJECT, WS, USER, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when membership not found', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      await expect(
        service.removeMember(PROJECT, WS, 'no-user', 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('changeRole', () => {
    it('updates role and emits ProjectMemberRoleChangedEvent', async () => {
      const existing = makeMembership({ role: ProjectRole.CONTRIBUTOR });
      memberRepo.findOne.mockResolvedValue(existing);
      memberRepo.count.mockResolvedValue(2); // 2 admins so demote is safe
      memberRepo.save.mockResolvedValue({
        ...existing,
        role: ProjectRole.ADMIN,
      });

      await service.changeRole(PROJECT, WS, USER, ProjectRole.ADMIN, 'actor-1');

      expect(memberRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(ProjectMemberRoleChangedEvent);
    });

    it('throws ConflictException when demoting the last ADMIN', async () => {
      const existing = makeMembership({ role: ProjectRole.ADMIN });
      memberRepo.findOne.mockResolvedValue(existing);
      memberRepo.count.mockResolvedValue(1); // only 1 admin

      await expect(
        service.changeRole(PROJECT, WS, USER, ProjectRole.CONTRIBUTOR, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when membership not found', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      await expect(
        service.changeRole(PROJECT, WS, 'no-user', ProjectRole.ADMIN, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listMembers', () => {
    it('returns safe member identities and roles for the project UI', async () => {
      const members = [
        makeMembership({
          user: {
            displayName: 'Alex Admin',
            email: 'admin@jitre.test',
            avatarUrl: null,
          },
        }),
      ];
      memberRepo.find.mockResolvedValue(members);

      const result = await service.listMembers(PROJECT, WS);
      expect(memberRepo.find).toHaveBeenCalledWith({
        where: { projectId: PROJECT, workspaceId: WS },
        relations: { user: true },
        order: { assignedAt: 'ASC' },
      });
      expect(result[0]).toEqual(
        expect.objectContaining({
          userId: USER,
          displayName: 'Alex Admin',
          email: 'admin@jitre.test',
          role: ProjectRole.ADMIN,
        }),
      );
      expect(result[0]).not.toHaveProperty('user');
    });
  });
});
