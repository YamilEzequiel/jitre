import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskChecklistService } from './task-checklist.service';
import { TaskChecklistItemEntity } from './task-checklist-item.entity';
import { TaskChecklistItemStatus } from '@jitre/shared';

const WS = 'ws-1';
const TASK = 'task-1';
const ITEM = 'item-1';
const ACTOR = 'user-1';

const makeTask = (overrides = {}) => ({
  id: TASK,
  workspaceId: WS,
  projectId: 'proj-1',
  ...overrides,
});

const makeItem = (
  overrides: Partial<TaskChecklistItemEntity> = {},
): TaskChecklistItemEntity =>
  ({
    id: ITEM,
    workspaceId: WS,
    taskId: TASK,
    content: 'criterio',
    status: TaskChecklistItemStatus.PENDING,
    order: 0,
    completedByUserId: null,
    completedAt: null,
    ...overrides,
  }) as unknown as TaskChecklistItemEntity;

describe('TaskChecklistService', () => {
  let service: TaskChecklistService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    softDelete: jest.Mock;
    maximum: jest.Mock;
  };
  let taskRepo: { findOne: jest.Mock };

  beforeEach(() => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      find: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
      maximum: jest.fn(),
    };
    taskRepo = { findOne: jest.fn() };
    service = new TaskChecklistService(repo as never, taskRepo as never);
  });

  describe('list', () => {
    it('returns items ordered by `order` ASC', async () => {
      const items = [makeItem({ id: 'a', order: 0 }), makeItem({ id: 'b', order: 1 })];
      taskRepo.findOne.mockResolvedValue(makeTask());
      repo.find.mockResolvedValue(items);

      const result = await service.list(TASK, WS);

      expect(repo.find).toHaveBeenCalledWith({
        where: { taskId: TASK, workspaceId: WS },
        order: { order: 'ASC', createdAt: 'ASC' },
      });
      expect(result).toEqual(items);
    });

    it('throws NotFoundException when task not in workspace', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.list(TASK, WS)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('appends to the end when no order is provided', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      repo.maximum.mockResolvedValue(2);
      repo.save.mockImplementation(async (x) => ({ ...x, id: 'new' }));

      const saved = await service.create({
        workspaceId: WS,
        taskId: TASK,
        content: 'caso de uso A',
      });

      expect(repo.maximum).toHaveBeenCalledWith('order', { taskId: TASK, workspaceId: WS });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: WS,
          taskId: TASK,
          content: 'caso de uso A',
          status: TaskChecklistItemStatus.PENDING,
          order: 3,
        }),
      );
      expect(saved.id).toBe('new');
    });

    it('uses 0 when the task has no items yet', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      repo.maximum.mockResolvedValue(null);

      await service.create({ workspaceId: WS, taskId: TASK, content: 'first' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ order: 0 }),
      );
    });

    it('honors explicit order when passed', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      repo.maximum.mockResolvedValue(5);

      await service.create({
        workspaceId: WS,
        taskId: TASK,
        content: 'mid',
        order: 2,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ order: 2 }),
      );
    });

    it('throws NotFoundException when the task does not belong to the workspace', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ workspaceId: WS, taskId: TASK, content: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates content only — never touches status/completion fields', async () => {
      const existing = makeItem({ content: 'old', status: TaskChecklistItemStatus.PASSED });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation(async (x) => x);

      await service.update(ITEM, WS, { content: 'new' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: ITEM,
          content: 'new',
          status: TaskChecklistItemStatus.PASSED,
        }),
      );
    });

    it('throws NotFoundException when item not in workspace', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(ITEM, WS, { content: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setStatus', () => {
    it('stamps completedByUserId + completedAt when moving out of pending', async () => {
      const existing = makeItem();
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation(async (x) => x);

      const result = await service.setStatus(
        ITEM,
        WS,
        ACTOR,
        TaskChecklistItemStatus.PASSED,
      );

      expect(result.status).toBe(TaskChecklistItemStatus.PASSED);
      expect(result.completedByUserId).toBe(ACTOR);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('overwrites completedBy/At when re-validating (passed -> failed)', async () => {
      const previousQa = 'user-OLD';
      const existing = makeItem({
        status: TaskChecklistItemStatus.PASSED,
        completedByUserId: previousQa,
        completedAt: new Date('2020-01-01'),
      });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation(async (x) => x);

      const result = await service.setStatus(
        ITEM,
        WS,
        ACTOR,
        TaskChecklistItemStatus.FAILED,
      );

      expect(result.status).toBe(TaskChecklistItemStatus.FAILED);
      expect(result.completedByUserId).toBe(ACTOR);
      expect((result.completedAt as Date).getFullYear()).toBeGreaterThan(2020);
    });

    it('clears completedBy/At when resetting to pending', async () => {
      const existing = makeItem({
        status: TaskChecklistItemStatus.PASSED,
        completedByUserId: ACTOR,
        completedAt: new Date(),
      });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation(async (x) => x);

      const result = await service.setStatus(
        ITEM,
        WS,
        ACTOR,
        TaskChecklistItemStatus.PENDING,
      );

      expect(result.status).toBe(TaskChecklistItemStatus.PENDING);
      expect(result.completedByUserId).toBeNull();
      expect(result.completedAt).toBeNull();
    });

    it('throws NotFoundException when item missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.setStatus(ITEM, WS, ACTOR, TaskChecklistItemStatus.PASSED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('persists the new order for every passed id', async () => {
      const a = makeItem({ id: 'a', order: 0 });
      const b = makeItem({ id: 'b', order: 1 });
      const c = makeItem({ id: 'c', order: 2 });
      taskRepo.findOne.mockResolvedValue(makeTask());
      repo.find.mockResolvedValue([a, b, c]);
      repo.save.mockImplementation(async (x) => x);

      await service.reorder(TASK, WS, ['c', 'a', 'b']);

      const saved = repo.save.mock.calls.map(([row]) => row);
      expect(saved.find((r) => r.id === 'c').order).toBe(0);
      expect(saved.find((r) => r.id === 'a').order).toBe(1);
      expect(saved.find((r) => r.id === 'b').order).toBe(2);
    });

    it('rejects when orderedIds is missing items belonging to the task', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      repo.find.mockResolvedValue([
        makeItem({ id: 'a' }),
        makeItem({ id: 'b' }),
      ]);

      await expect(service.reorder(TASK, WS, ['a'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when orderedIds contains foreign ids', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      repo.find.mockResolvedValue([makeItem({ id: 'a' })]);

      await expect(service.reorder(TASK, WS, ['a', 'ghost'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when task missing', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.reorder(TASK, WS, ['a'])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes the item', async () => {
      repo.findOne.mockResolvedValue(makeItem());
      repo.softDelete.mockResolvedValue({ affected: 1 });

      await service.remove(ITEM, WS);

      expect(repo.softDelete).toHaveBeenCalledWith(ITEM);
    });

    it('throws NotFoundException when item missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(ITEM, WS)).rejects.toThrow(NotFoundException);
    });
  });
});
