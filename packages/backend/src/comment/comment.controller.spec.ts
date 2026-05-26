import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentContext, WorkspaceRole } from '@jitre/shared';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const mockService = {
  create: jest.fn(),
  list: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

function makeReq(overrides = {}): unknown {
  return {
    user: { id: 'U1' },
    workspace: { id: 'W1', role: WorkspaceRole.MEMBER },
    ...overrides,
  };
}

function makeComment(id = 'C1') {
  return {
    id,
    workspaceId: 'W1',
    contextType: CommentContext.TASK,
    contextId: 'T1',
    authorUserId: 'U1',
    body: 'Hello',
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CommentController', () => {
  let controller: CommentController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [{ provide: CommentService, useValue: mockService }],
    }).compile();

    controller = module.get(CommentController);
  });

  describe('create() — POST /comments', () => {
    it('delegates to service.create and returns the created comment', async () => {
      const comment = makeComment();
      mockService.create.mockResolvedValueOnce(comment);

      const dto = {
        contextType: CommentContext.TASK,
        contextId: 'T1',
        body: 'Hello',
      };
      const result = await controller.create(
        dto,
        makeReq() as Parameters<typeof controller.create>[1],
      );

      expect(mockService.create).toHaveBeenCalledWith({
        workspaceId: 'W1',
        contextType: CommentContext.TASK,
        contextId: 'T1',
        authorUserId: 'U1',
        body: 'Hello',
        parentId: undefined,
      });
      expect(result.id).toBe('C1');
    });

    it('propagates BadRequestException from service (MAX_THREAD_DEPTH)', async () => {
      mockService.create.mockRejectedValueOnce(
        new BadRequestException('MAX_THREAD_DEPTH'),
      );

      const dto = {
        contextType: CommentContext.TASK,
        contextId: 'T1',
        body: 'Deep',
        parentId: 'X',
      };
      await expect(
        controller.create(
          dto,
          makeReq() as Parameters<typeof controller.create>[1],
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('list() — GET /comments', () => {
    it('returns paginated list scoped to workspace', async () => {
      const page = { data: [makeComment()], total: 1, page: 1, limit: 20 };
      mockService.list.mockResolvedValueOnce(page);

      const result = await controller.list(
        {
          contextType: CommentContext.TASK,
          contextId: 'T1',
          page: 1,
          limit: 20,
        },
        makeReq() as Parameters<typeof controller.list>[1],
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('passes workspace scope to service', async () => {
      mockService.list.mockResolvedValueOnce({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await controller.list(
        {
          contextType: CommentContext.TASK,
          contextId: 'T1',
          page: 1,
          limit: 20,
        },
        makeReq({
          workspace: { id: 'W_CUSTOM', role: WorkspaceRole.MEMBER },
        }) as Parameters<typeof controller.list>[1],
      );

      expect(mockService.list).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'W_CUSTOM' }),
      );
    });
  });

  describe('findOne() — GET /comments/:id', () => {
    it('returns a single comment', async () => {
      const comment = makeComment();
      mockService.findOne.mockResolvedValueOnce(comment);

      const result = await controller.findOne(
        'C1',
        makeReq() as Parameters<typeof controller.findOne>[1],
      );
      expect(result.id).toBe('C1');
    });

    it('throws NotFoundException when not found', async () => {
      mockService.findOne.mockRejectedValueOnce(
        new NotFoundException('COMMENT_NOT_FOUND'),
      );

      await expect(
        controller.findOne(
          'NOPE',
          makeReq() as Parameters<typeof controller.findOne>[1],
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update() — PATCH /comments/:id', () => {
    it('delegates to service.update and returns updated comment', async () => {
      const updated = makeComment();
      mockService.update.mockResolvedValueOnce(updated);

      const result = await controller.update(
        'C1',
        { body: 'Updated' },
        makeReq() as Parameters<typeof controller.update>[2],
      );

      expect(mockService.update).toHaveBeenCalledWith({
        id: 'C1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        actorRole: WorkspaceRole.MEMBER,
        newBody: 'Updated',
      });
      expect(result.id).toBe('C1');
    });

    it('propagates ForbiddenException from service (EDIT_WINDOW_EXPIRED)', async () => {
      mockService.update.mockRejectedValueOnce(
        new ForbiddenException('EDIT_WINDOW_EXPIRED'),
      );

      await expect(
        controller.update(
          'C1',
          { body: 'Late edit' },
          makeReq() as Parameters<typeof controller.update>[2],
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove() — DELETE /comments/:id', () => {
    it('delegates to service.remove and returns 204 (void)', async () => {
      mockService.remove.mockResolvedValueOnce(undefined);

      await expect(
        controller.remove(
          'C1',
          makeReq() as Parameters<typeof controller.remove>[1],
        ),
      ).resolves.toBeUndefined();

      expect(mockService.remove).toHaveBeenCalledWith({
        id: 'C1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        actorRole: WorkspaceRole.MEMBER,
      });
    });

    it('propagates ForbiddenException when non-author non-admin tries to delete', async () => {
      mockService.remove.mockRejectedValueOnce(
        new ForbiddenException('INSUFFICIENT_PERMISSION'),
      );

      await expect(
        controller.remove(
          'C1',
          makeReq() as Parameters<typeof controller.remove>[1],
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
