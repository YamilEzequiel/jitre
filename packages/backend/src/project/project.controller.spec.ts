import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectMembershipService } from './project-membership/project-membership.service';
import { ProjectStatus, ProjectRole } from '@jitre/shared';

const mockProjectService = {
  create: jest.fn(),
  update: jest.fn(),
  archive: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
};

const mockMembershipService = {
  addMember: jest.fn(),
  removeMember: jest.fn(),
  changeRole: jest.fn(),
  listMembers: jest.fn(),
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-1' },
  workspace: { id: 'ws-1', role: 'admin' },
  ...overrides,
});

describe('ProjectController', () => {
  let controller: ProjectController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockProjectService.getById.mockResolvedValue({ id: 'proj-1' });
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ProjectMembershipService, useValue: mockMembershipService },
      ],
    }).compile();

    controller = module.get<ProjectController>(ProjectController);
  });

  describe('create — POST /projects', () => {
    it('creates a project and returns 201', async () => {
      const project = {
        id: 'proj-1',
        name: 'Test',
        key: 'TEST',
        status: ProjectStatus.ACTIVE,
      };
      mockProjectService.create.mockResolvedValue(project);

      const result = await controller.create(
        { name: 'Test', key: 'TEST' },
        makeReq() as never,
      );

      expect(mockProjectService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test', key: 'TEST' }),
      );
      expect(result).toEqual(project);
    });
  });

  describe('list — GET /projects', () => {
    it('returns list of projects', async () => {
      const projects = [{ id: 'p1' }, { id: 'p2' }];
      mockProjectService.list.mockResolvedValue(projects);

      const result = await controller.list(makeReq() as never);

      expect(result).toEqual(projects);
    });
  });

  describe('getById — GET /projects/:id', () => {
    it('returns the project when found', async () => {
      const project = { id: 'proj-1', name: 'Test' };
      mockProjectService.getById.mockResolvedValue(project);

      const result = await controller.getById('proj-1', makeReq() as never);
      expect(result).toEqual(project);
      expect(mockProjectService.getById).toHaveBeenCalledWith('proj-1', 'ws-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockProjectService.getById.mockRejectedValue(new NotFoundException());

      await expect(controller.getById('missing', makeReq() as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update — PATCH /projects/:id', () => {
    it('updates and returns project', async () => {
      const updated = { id: 'proj-1', name: 'Updated' };
      mockProjectService.update.mockResolvedValue(updated);

      const result = await controller.update(
        'proj-1',
        { name: 'Updated' },
        makeReq() as never,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('archive — DELETE /projects/:id', () => {
    it('archives project with no active tasks', async () => {
      mockProjectService.archive.mockResolvedValue({
        id: 'proj-1',
        status: ProjectStatus.ARCHIVED,
      });

      const result = await controller.archive('proj-1', makeReq() as never);
      expect(result).toBeDefined();
    });

    it('throws ConflictException when active tasks exist', async () => {
      mockProjectService.archive.mockRejectedValue(new ConflictException());

      await expect(
        controller.archive('proj-1', makeReq() as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('addMember — POST /projects/:id/members', () => {
    it('adds a member and returns membership', async () => {
      const membership = {
        id: 'm1',
        userId: 'u2',
        role: ProjectRole.CONTRIBUTOR,
      };
      mockMembershipService.addMember.mockResolvedValue(membership);

      const result = await controller.addMember(
        'proj-1',
        { userId: 'u2', role: ProjectRole.CONTRIBUTOR },
        makeReq() as never,
      );
      expect(result).toEqual(membership);
    });
  });

  describe('removeMember — DELETE /projects/:id/members/:userId', () => {
    it('removes a member', async () => {
      mockMembershipService.removeMember.mockResolvedValue(undefined);

      await controller.removeMember('proj-1', 'u2', makeReq() as never);
      expect(mockMembershipService.removeMember).toHaveBeenCalledWith(
        'proj-1',
        'ws-1',
        'u2',
        'user-1',
      );
    });

    it('throws ConflictException for last admin removal', async () => {
      mockMembershipService.removeMember.mockRejectedValue(
        new ConflictException(),
      );

      await expect(
        controller.removeMember('proj-1', 'u1', makeReq() as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateMember — PATCH /projects/:id/members/:userId', () => {
    it('changes member role', async () => {
      const updated = { id: 'm1', userId: 'u2', role: ProjectRole.ADMIN };
      mockMembershipService.changeRole.mockResolvedValue(updated);

      const result = await controller.updateMember(
        'proj-1',
        'u2',
        { role: ProjectRole.ADMIN },
        makeReq() as never,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('listMembers — GET /projects/:id/members', () => {
    it('lists project members', async () => {
      const members = [{ id: 'm1' }, { id: 'm2' }];
      mockMembershipService.listMembers.mockResolvedValue(members);

      const result = await controller.listMembers('proj-1', makeReq() as never);
      expect(result).toEqual(members);
      expect(mockMembershipService.listMembers).toHaveBeenCalledWith('proj-1', 'ws-1');
    });
  });
});
