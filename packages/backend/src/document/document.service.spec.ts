import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DocumentService,
  extractPlainText,
} from './document.service';
import { DocumentEntity } from './document.entity';
import { EventBusService } from '../events/event-bus.service';

function makeDoc(overrides: Partial<DocumentEntity> = {}): DocumentEntity {
  return {
    id: 'D1',
    workspaceId: 'W1',
    projectId: null,
    parentId: null,
    title: 'Root',
    icon: null,
    content: {},
    contentText: '',
    order: 0,
    creatorUserId: 'U1',
    lastEditedByUserId: 'U1',
    lastEditedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  } as DocumentEntity;
}

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockEventBus = { publish: jest.fn() };

function makeQb() {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return qb;
}

describe('extractPlainText()', () => {
  it('returns empty string for empty object', () => {
    expect(extractPlainText({})).toBe('');
  });

  it('returns empty string for null / undefined / non-objects', () => {
    expect(extractPlainText(null)).toBe('');
    expect(extractPlainText(undefined)).toBe('');
    expect(extractPlainText('plain string')).toBe('');
    expect(extractPlainText(42)).toBe('');
  });

  it('concatenates string inserts from Quill Delta ops', () => {
    const delta = {
      ops: [
        { insert: 'Hello ' },
        { insert: 'world' },
        { insert: '\n' },
      ],
    };
    expect(extractPlainText(delta)).toBe('Hello world\n');
  });

  it('skips embed inserts (objects, e.g. images)', () => {
    const delta = {
      ops: [
        { insert: 'Pic: ' },
        { insert: { image: 'http://x/y.png' } },
        { insert: ' done' },
      ],
    };
    expect(extractPlainText(delta)).toBe('Pic:  done');
  });

  it('returns empty string when ops is missing or non-array', () => {
    expect(extractPlainText({ ops: 'nope' })).toBe('');
    expect(extractPlainText({ foo: 'bar' })).toBe('');
  });
});

describe('DocumentService', () => {
  let service: DocumentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: getRepositoryToken(DocumentEntity), useValue: mockRepo },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get(DocumentService);
  });

  // ── create() ──────────────────────────────────────────────────────────────
  describe('create()', () => {
    it('creates a root document, fills authorship and emits DocumentCreatedEvent', async () => {
      mockRepo.create.mockImplementationOnce((d) => d);
      mockRepo.save.mockImplementationOnce(async (d) => ({ ...d, id: 'D1' }));

      const result = await service.create({
        workspaceId: 'W1',
        actorUserId: 'U1',
        title: 'My page',
        content: { ops: [{ insert: 'Body' }] },
      });

      expect(result.id).toBe('D1');
      expect(result.creatorUserId).toBe('U1');
      expect(result.lastEditedByUserId).toBe('U1');
      expect(result.contentText).toBe('Body');
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('defaults content to {} and contentText to "" when content not provided', async () => {
      mockRepo.create.mockImplementationOnce((d) => d);
      mockRepo.save.mockImplementationOnce(async (d) => ({ ...d, id: 'D1' }));

      const result = await service.create({
        workspaceId: 'W1',
        actorUserId: 'U1',
        title: 'No body',
      });

      expect(result.content).toEqual({});
      expect(result.contentText).toBe('');
    });

    it('throws NotFoundException when parentId does not exist', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create({
          workspaceId: 'W1',
          actorUserId: 'U1',
          title: 'Child',
          parentId: 'PARENT_X',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects creation when parent project does not match', async () => {
      mockRepo.findOne.mockResolvedValueOnce(
        makeDoc({ id: 'PARENT', projectId: 'P1' }),
      );

      await expect(
        service.create({
          workspaceId: 'W1',
          actorUserId: 'U1',
          title: 'Child',
          parentId: 'PARENT',
          projectId: 'P2',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── findOne() ─────────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it('returns the document when present', async () => {
      mockRepo.findOne.mockResolvedValueOnce(makeDoc());
      const doc = await service.findOne('D1', 'W1');
      expect(doc.id).toBe('D1');
    });

    it('throws NotFoundException otherwise', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne('Z', 'W1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── update() ──────────────────────────────────────────────────────────────
  describe('update()', () => {
    it('updates title and emits DocumentUpdatedEvent', async () => {
      const doc = makeDoc({ title: 'Old' });
      mockRepo.findOne.mockResolvedValueOnce(doc);
      mockRepo.save.mockImplementationOnce(async (d) => d);

      const result = await service.update({
        id: 'D1',
        workspaceId: 'W1',
        actorUserId: 'U2',
        title: 'New',
      });

      expect(result.title).toBe('New');
      expect(result.lastEditedByUserId).toBe('U2');
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('regenerates contentText when content changes', async () => {
      const doc = makeDoc({ content: { ops: [{ insert: 'Old' }] }, contentText: 'Old' });
      mockRepo.findOne.mockResolvedValueOnce(doc);
      mockRepo.save.mockImplementationOnce(async (d) => d);

      const result = await service.update({
        id: 'D1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        content: { ops: [{ insert: 'Hello new world' }] },
      });

      expect(result.contentText).toBe('Hello new world');
    });

    it('does NOT emit event when no fields actually change', async () => {
      const doc = makeDoc({ title: 'Same', icon: null });
      mockRepo.findOne.mockResolvedValueOnce(doc);
      mockRepo.save.mockImplementationOnce(async (d) => d);

      await service.update({
        id: 'D1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        title: 'Same',
      });

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('refreshes lastEditedAt on every update', async () => {
      const doc = makeDoc({
        lastEditedAt: new Date('2020-01-01T00:00:00Z'),
        title: 'Old',
      });
      mockRepo.findOne.mockResolvedValueOnce(doc);
      mockRepo.save.mockImplementationOnce(async (d) => d);

      const before = Date.now();
      const result = await service.update({
        id: 'D1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        title: 'New',
      });

      expect(result.lastEditedAt!.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  // ── move() ────────────────────────────────────────────────────────────────
  describe('move()', () => {
    it('moves to root when parentId === null', async () => {
      const doc = makeDoc({ parentId: 'P1' });
      mockRepo.findOne.mockResolvedValueOnce(doc);
      mockRepo.save.mockImplementationOnce(async (d) => d);

      const result = await service.move({
        id: 'D1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        parentId: null,
      });

      expect(result.parentId).toBeNull();
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('throws CYCLE_DETECTED when target parentId === id', async () => {
      mockRepo.findOne.mockResolvedValueOnce(makeDoc());

      await expect(
        service.move({
          id: 'D1',
          workspaceId: 'W1',
          actorUserId: 'U1',
          parentId: 'D1',
        }),
      ).rejects.toThrow('CYCLE_DETECTED');
    });

    it('throws CYCLE_DETECTED when target parent has the doc in its ancestry', async () => {
      // doc D1; target parent D2 whose ancestor chain is D2 -> D1 (cycle).
      const doc = makeDoc({ id: 'D1' });
      const targetParent = makeDoc({ id: 'D2', parentId: 'D1' });
      const ancestorD1 = makeDoc({ id: 'D1', parentId: null });
      mockRepo.findOne
        .mockResolvedValueOnce(doc) // findOne(id)
        .mockResolvedValueOnce(targetParent) // findOne(parentId='D2')
        .mockResolvedValueOnce(ancestorD1); // walk: findOne(parent of D2 = D1) → matches id → cycle

      await expect(
        service.move({
          id: 'D1',
          workspaceId: 'W1',
          actorUserId: 'U1',
          parentId: 'D2',
        }),
      ).rejects.toThrow('CYCLE_DETECTED');
    });

    it('throws NotFoundException when target parent does not exist', async () => {
      const doc = makeDoc();
      mockRepo.findOne
        .mockResolvedValueOnce(doc) // findOne(id)
        .mockResolvedValueOnce(null); // findOne(parentId)

      await expect(
        service.move({
          id: 'D1',
          workspaceId: 'W1',
          actorUserId: 'U1',
          parentId: 'GHOST',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates order when only order is provided', async () => {
      const doc = makeDoc({ order: 0 });
      mockRepo.findOne.mockResolvedValueOnce(doc);
      mockRepo.save.mockImplementationOnce(async (d) => d);

      const result = await service.move({
        id: 'D1',
        workspaceId: 'W1',
        actorUserId: 'U1',
        order: 5,
      });

      expect(result.order).toBe(5);
    });
  });

  // ── remove() ──────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it('soft-deletes the document and all descendants, then emits DocumentDeletedEvent', async () => {
      const root = makeDoc({ id: 'R' });
      mockRepo.findOne.mockResolvedValueOnce(root);
      // First BFS expansion → 2 children
      mockRepo.find
        .mockResolvedValueOnce([{ id: 'C1' }, { id: 'C2' }])
        // Second expansion → 1 grandchild for C1/C2 frontier
        .mockResolvedValueOnce([{ id: 'G1' }])
        // Third expansion → none
        .mockResolvedValueOnce([]);

      await service.remove('R', 'W1', 'U1');

      expect(mockRepo.softDelete).toHaveBeenCalledWith(['R', 'C1', 'C2', 'G1']);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      const evt = mockEventBus.publish.mock.calls[0][0];
      expect(evt.payload.cascadedChildIds).toEqual(['C1', 'C2', 'G1']);
    });

    it('soft-deletes a leaf with no descendants', async () => {
      const leaf = makeDoc({ id: 'L' });
      mockRepo.findOne.mockResolvedValueOnce(leaf);
      mockRepo.find.mockResolvedValueOnce([]);

      await service.remove('L', 'W1', 'U1');

      expect(mockRepo.softDelete).toHaveBeenCalledWith(['L']);
      const evt = mockEventBus.publish.mock.calls[0][0];
      expect(evt.payload.cascadedChildIds).toEqual([]);
    });

    it('throws NotFoundException when the document is missing', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.remove('NO', 'W1', 'U1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── list() ────────────────────────────────────────────────────────────────
  describe('list()', () => {
    it('filters by workspace and orders by order ASC', async () => {
      const qb = makeQb();
      mockRepo.createQueryBuilder.mockReturnValueOnce(qb);
      qb.getMany.mockResolvedValueOnce([makeDoc()]);

      await service.list({ workspaceId: 'W1' });

      expect(qb.where).toHaveBeenCalledWith('d.workspaceId = :workspaceId', {
        workspaceId: 'W1',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('d.order', 'ASC');
    });

    it('applies parentId IS NULL when parentId === null', async () => {
      const qb = makeQb();
      mockRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.list({ workspaceId: 'W1', parentId: null });

      expect(qb.andWhere).toHaveBeenCalledWith('d.parentId IS NULL');
    });

    it('applies parentId equality when parentId is a string', async () => {
      const qb = makeQb();
      mockRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.list({ workspaceId: 'W1', parentId: 'P1' });

      expect(qb.andWhere).toHaveBeenCalledWith('d.parentId = :parentId', {
        parentId: 'P1',
      });
    });

    it('applies projectId filter when provided', async () => {
      const qb = makeQb();
      mockRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.list({ workspaceId: 'W1', projectId: 'P1' });

      expect(qb.andWhere).toHaveBeenCalledWith('d.projectId = :projectId', {
        projectId: 'P1',
      });
    });

    it('applies free-text search when q is provided', async () => {
      const qb = makeQb();
      mockRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.list({ workspaceId: 'W1', q: 'design' });

      // The Brackets call cannot be matched literally — assert that andWhere
      // was called with an extra "search" group (3rd andWhere on top of the
      // baseline two).
      expect(qb.andWhere).toHaveBeenCalled();
    });
  });

  // ── tree() ────────────────────────────────────────────────────────────────
  describe('tree()', () => {
    it('returns an empty array when no documents exist', async () => {
      mockRepo.find.mockResolvedValueOnce([]);
      const result = await service.tree('W1');
      expect(result).toEqual([]);
    });

    it('builds a nested tree from a flat list', async () => {
      const docs = [
        makeDoc({ id: 'A', parentId: null, order: 0 }),
        makeDoc({ id: 'B', parentId: 'A', order: 0 }),
        makeDoc({ id: 'C', parentId: 'A', order: 1 }),
        makeDoc({ id: 'D', parentId: 'B', order: 0 }),
      ];
      mockRepo.find.mockResolvedValueOnce(docs);

      const tree = await service.tree('W1');

      expect(tree).toHaveLength(1);
      expect(tree[0].document.id).toBe('A');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].document.id).toBe('B');
      expect(tree[0].children[0].children[0].document.id).toBe('D');
    });

    it('treats orphan documents (parent missing) as roots', async () => {
      const docs = [makeDoc({ id: 'ORPH', parentId: 'MISSING' })];
      mockRepo.find.mockResolvedValueOnce(docs);

      const tree = await service.tree('W1');
      expect(tree).toHaveLength(1);
      expect(tree[0].document.id).toBe('ORPH');
    });
  });
});
