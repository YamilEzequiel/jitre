import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { REQUIRE_ABILITY_KEY } from '../auth/decorators/require-ability.decorator';
import { AbilityGuard } from '../auth/guards/ability.guard';
import { WorkspaceRole } from '@jitre/shared';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

const mockService = {
  create: jest.fn(),
  list: jest.fn(),
  tree: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  move: jest.fn(),
  remove: jest.fn(),
};

function makeReq(overrides = {}): unknown {
  return {
    user: { id: 'U1' },
    workspace: { id: 'W1', role: WorkspaceRole.MEMBER },
    ...overrides,
  };
}

function makeDoc(id = 'D1') {
  return {
    id,
    workspaceId: 'W1',
    projectId: null,
    parentId: null,
    title: 'Title',
    icon: null,
    content: {},
    contentText: '',
    order: 0,
    creatorUserId: 'U1',
    lastEditedByUserId: 'U1',
    lastEditedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function getAbilityFn(
  handler: object,
): ((ability: { can: (action: string, subject: string) => boolean }) => boolean) | undefined {
  return Reflect.getMetadata(REQUIRE_ABILITY_KEY, handler) as
    | ((ability: { can: (action: string, subject: string) => boolean }) => boolean)
    | undefined;
}

describe('DocumentController', () => {
  let controller: DocumentController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [{ provide: DocumentService, useValue: mockService }],
    })
      .overrideGuard(AbilityGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DocumentController);
  });

  describe('POST /documents', () => {
    it('requires create Document ability', () => {
      const fn = getAbilityFn(controller.create);
      expect(fn).toBeDefined();
      expect(fn!({ can: (action, subject) => action === 'create' && subject === 'Document' })).toBe(true);
      expect(fn!({ can: () => false })).toBe(false);
    });

    it('delegates to service.create with workspace + actor pulled from request', async () => {
      mockService.create.mockResolvedValueOnce(makeDoc());

      const dto = {
        title: 'Spec page',
        projectId: 'P1',
        parentId: 'D0',
        content: { ops: [{ insert: 'Body' }] },
        icon: '📄',
        order: 2,
      };

      const result = await controller.create(
        dto,
        makeReq() as Parameters<typeof controller.create>[1],
      );

      expect(mockService.create).toHaveBeenCalledWith({
        workspaceId: 'W1',
        actorUserId: 'U1',
        title: 'Spec page',
        projectId: 'P1',
        parentId: 'D0',
        content: dto.content,
        icon: '📄',
        order: 2,
      });
      // narrow to a shape we control
      expect((result as { id: string }).id).toBe('D1');
    });

    it('defaults missing optional fields to null', async () => {
      mockService.create.mockResolvedValueOnce(makeDoc());

      await controller.create(
        { title: 'Plain' },
        makeReq() as Parameters<typeof controller.create>[1],
      );

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: null, parentId: null, icon: null }),
      );
    });
  });

  describe('GET /documents', () => {
    it('passes filters through to service.list', async () => {
      mockService.list.mockResolvedValueOnce([]);

      await controller.list(
        { projectId: 'P1', parentId: null, q: 'design' },
        makeReq() as Parameters<typeof controller.list>[1],
      );

      expect(mockService.list).toHaveBeenCalledWith({
        workspaceId: 'W1',
        projectId: 'P1',
        parentId: null,
        q: 'design',
      });
    });
  });

  describe('GET /documents/tree', () => {
    it('requires read Document ability', () => {
      const fn = getAbilityFn(controller.tree);
      expect(fn).toBeDefined();
      expect(fn!({ can: (action, subject) => action === 'read' && subject === 'Document' })).toBe(true);
      expect(fn!({ can: () => false })).toBe(false);
    });

    it('treats the literal string "null" as project=null', async () => {
      mockService.tree.mockResolvedValueOnce([]);

      await controller.tree(
        'null',
        makeReq() as Parameters<typeof controller.tree>[1],
      );

      expect(mockService.tree).toHaveBeenCalledWith('W1', null);
    });

    it('passes a real project id straight through', async () => {
      mockService.tree.mockResolvedValueOnce([]);

      await controller.tree(
        'P1',
        makeReq() as Parameters<typeof controller.tree>[1],
      );

      expect(mockService.tree).toHaveBeenCalledWith('W1', 'P1');
    });

    it('passes undefined when no projectId query is provided', async () => {
      mockService.tree.mockResolvedValueOnce([]);

      await controller.tree(
        undefined,
        makeReq() as Parameters<typeof controller.tree>[1],
      );

      expect(mockService.tree).toHaveBeenCalledWith('W1', undefined);
    });

    it('serializes tree nodes as nested documents for the frontend contract', async () => {
      mockService.tree.mockResolvedValueOnce([
        {
          document: makeDoc('ROOT'),
          children: [{ document: makeDoc('CHILD'), children: [] }],
        },
      ]);

      const result = await controller.tree(
        undefined,
        makeReq() as Parameters<typeof controller.tree>[1],
      ) as Array<{ id: string; children: Array<{ id: string }> }>;

      expect(result[0].id).toBe('ROOT');
      expect(result[0].children[0].id).toBe('CHILD');
      expect(result[0]).not.toHaveProperty('document');
    });
  });

  describe('GET /documents/:id', () => {
    it('returns the document', async () => {
      mockService.findOne.mockResolvedValueOnce(makeDoc('D7'));
      const result = await controller.findOne(
        'D7',
        makeReq() as Parameters<typeof controller.findOne>[1],
      );
      expect(mockService.findOne).toHaveBeenCalledWith('D7', 'W1');
      expect((result as { id: string }).id).toBe('D7');
    });

    it('propagates NotFoundException from service', async () => {
      mockService.findOne.mockRejectedValueOnce(new NotFoundException());
      await expect(
        controller.findOne(
          'GHOST',
          makeReq() as Parameters<typeof controller.findOne>[1],
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /documents/:id', () => {
    it('requires update Document ability', () => {
      const fn = getAbilityFn(controller.update);
      expect(fn).toBeDefined();
      expect(fn!({ can: (action, subject) => action === 'update' && subject === 'Document' })).toBe(true);
      expect(fn!({ can: () => false })).toBe(false);
    });

    it('forwards partial fields to service.update', async () => {
      mockService.update.mockResolvedValueOnce(makeDoc());
      await controller.update(
        'D1',
        { title: 'Renamed' },
        makeReq() as Parameters<typeof controller.update>[2],
      );

      expect(mockService.update).toHaveBeenCalledWith({
        id: 'D1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        title: 'Renamed',
        content: undefined,
        icon: undefined,
        order: undefined,
      });
    });
  });

  describe('PATCH /documents/:id/move', () => {
    it('forwards parentId/order to service.move', async () => {
      mockService.move.mockResolvedValueOnce(makeDoc());
      await controller.move(
        'D1',
        { parentId: 'D9', order: 3 },
        makeReq() as Parameters<typeof controller.move>[2],
      );

      expect(mockService.move).toHaveBeenCalledWith({
        id: 'D1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        parentId: 'D9',
        order: 3,
      });
    });

    it('forwards explicit null parentId to service.move (move to root)', async () => {
      mockService.move.mockResolvedValueOnce(makeDoc());
      await controller.move(
        'D1',
        { parentId: null },
        makeReq() as Parameters<typeof controller.move>[2],
      );
      expect(mockService.move).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: null }),
      );
    });
  });

  describe('DELETE /documents/:id', () => {
    it('requires delete Document ability', () => {
      const fn = getAbilityFn(controller.remove);
      expect(fn).toBeDefined();
      expect(fn!({ can: (action, subject) => action === 'delete' && subject === 'Document' })).toBe(true);
      expect(fn!({ can: () => false })).toBe(false);
    });

    it('delegates to service.remove with workspace + actor', async () => {
      mockService.remove.mockResolvedValueOnce(undefined);
      await controller.remove(
        'D1',
        makeReq() as Parameters<typeof controller.remove>[1],
      );
      expect(mockService.remove).toHaveBeenCalledWith('D1', 'W1', 'U1');
    });
  });
});
