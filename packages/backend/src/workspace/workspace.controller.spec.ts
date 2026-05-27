import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { WorkspaceRole } from '@jitre/shared';
import { AttachmentService } from '../attachment/attachment.service';

const mockWsService = {
  create: jest.fn(),
  listForUser: jest.fn(),
  listContacts: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
  updateMemberRole: jest.fn(),
};

const mockAttachmentService = {
  replaceAvatar: jest.fn(),
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-1' },
  headers: { 'x-workspace-id': 'ws-1' },
  ...overrides,
});

describe('WorkspaceController', () => {
  let controller: WorkspaceController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceController],
      providers: [
        { provide: WorkspaceService, useValue: mockWsService },
        { provide: AttachmentService, useValue: mockAttachmentService },
      ],
    }).compile();

    controller = module.get<WorkspaceController>(WorkspaceController);
  });

  describe('create', () => {
    it('should call workspaceService.create and return created workspace', async () => {
      const ws = { id: 'ws-1', name: 'My WS', slug: 'my-ws' };
      mockWsService.create.mockResolvedValue(ws);
      const dto = { name: 'My WS', slug: 'my-ws' };
      const req = makeReq();

      const result = await controller.create(dto, req as never);

      expect(mockWsService.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(ws);
    });
  });

  describe('list', () => {
    it('should return all workspaces for the current user', async () => {
      const workspaces = [{ id: 'ws-1' }, { id: 'ws-2' }];
      mockWsService.listForUser.mockResolvedValue(workspaces);
      const req = makeReq();

      const result = await controller.list(req as never);

      expect(mockWsService.listForUser).toHaveBeenCalledWith('user-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('addMember', () => {
    it('should call workspaceService.addMember and return new membership', async () => {
      const membership = {
        id: 'm1',
        userId: 'u2',
        workspaceId: 'ws-1',
        role: WorkspaceRole.MEMBER,
      };
      mockWsService.addMember.mockResolvedValue(membership);
      const dto = { userId: 'u2', role: WorkspaceRole.MEMBER };

      const result = await controller.addMember('ws-1', dto);

      expect(mockWsService.addMember).toHaveBeenCalledWith('ws-1', dto);
      expect(result).toEqual(membership);
    });
  });

  describe('listMembers', () => {
    it('returns safe workspace contacts used to start direct messages', async () => {
      const contacts = [{ userId: 'u2', displayName: 'Maya' }];
      mockWsService.listContacts.mockResolvedValue(contacts);

      const result = await controller.listMembers('ws-1');

      expect(mockWsService.listContacts).toHaveBeenCalledWith('ws-1');
      expect(result).toEqual(contacts);
    });
  });

  describe('removeMember', () => {
    it('should call workspaceService.removeMember', async () => {
      mockWsService.removeMember.mockResolvedValue(undefined);

      await controller.removeMember('ws-1', 'u2');

      expect(mockWsService.removeMember).toHaveBeenCalledWith('ws-1', 'u2');
    });
  });

  describe('updateMemberRole', () => {
    it('forwards the actor identity and role to the service', async () => {
      const updated = {
        id: 'm2',
        userId: 'u2',
        workspaceId: 'ws-1',
        role: WorkspaceRole.ADMIN,
      };
      mockWsService.updateMemberRole.mockResolvedValue(updated);
      const dto = { role: WorkspaceRole.ADMIN };
      const req = {
        user: { id: 'user-1' },
        workspace: { id: 'ws-1', role: WorkspaceRole.OWNER },
      };

      const result = await controller.updateMemberRole(
        'ws-1',
        'u2',
        dto,
        req as never,
      );

      expect(mockWsService.updateMemberRole).toHaveBeenCalledWith(
        'ws-1',
        'u2',
        WorkspaceRole.ADMIN,
        'user-1',
        WorkspaceRole.OWNER,
      );
      expect(result).toEqual(updated);
    });
  });
});
