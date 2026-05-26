import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskEntity } from './task.entity';
import { TaskPriority, StatusCategory, TaskType } from '@jitre/shared';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskCompletedEvent,
  TaskDeletedEvent,
} from './events';

const WS = 'ws-1';
const PROJECT = 'proj-1';
const ACTOR = 'user-1';

const makeTask = (overrides: Partial<TaskEntity> = {}): TaskEntity =>
  ({
    id: 'task-1',
    workspaceId: WS,
    projectId: PROJECT,
    statusId: 'status-todo',
    title: 'Fix bug',
    description: null,
    priority: TaskPriority.MEDIUM,
    dueDate: null,
    startDate: null,
    estimatedHours: null,
    parentTaskId: null,
    rank: 'n',
    customFields: {},
    completedAt: null,
    deletedAt: null,
    type: TaskType.TASK,
    ...overrides,
  }) as unknown as TaskEntity;

const makeStatus = (category: StatusCategory, id = 'status-1') => ({
  id,
  workspaceId: WS,
  category,
  name: 'Status',
  isDefault: false,
});

describe('TaskService â€” CRUD cluster', () => {
  let service: TaskService;
  let taskRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    softDelete: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let statusRepo: { findOne: jest.Mock };
  let projectRepo: { findOne: jest.Mock };
  let planningRepo: { findOne: jest.Mock };
  let lexorank: { between: jest.Mock };
  let customFieldService: { validateTaskCustomFields: jest.Mock };
  let assignmentService: { assign: jest.Mock; listAssignees: jest.Mock };
  let labelService: { addLabel: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    taskRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    statusRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue(makeStatus(StatusCategory.TODO, 'status-todo')),
    };
    projectRepo = { findOne: jest.fn().mockResolvedValue({ id: PROJECT, key: 'JIT' }) };
    planningRepo = { findOne: jest.fn().mockResolvedValue({ id: 'planning-1' }) };
    const issueQb = {
      withDeleted: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
    };
    taskRepo.createQueryBuilder.mockReturnValue(issueQb);
    lexorank = { between: jest.fn().mockReturnValue('n') };
    customFieldService = {
      validateTaskCustomFields: jest.fn().mockResolvedValue([]),
    };
    assignmentService = {
      assign: jest.fn().mockResolvedValue({}),
      listAssignees: jest.fn().mockResolvedValue([]),
    };
    labelService = { addLabel: jest.fn().mockResolvedValue({}) };
    eventBus = { publish: jest.fn() };

    service = new TaskService(
      taskRepo as never,
      statusRepo as never,
      projectRepo as never,
      planningRepo as never,
      lexorank as never,
      customFieldService as never,
      assignmentService as never,
      labelService as never,
      eventBus as never,
    );
  });

  describe('create', () => {
    it('creates a task with lexorank rank and emits TaskCreatedEvent', async () => {
      const task = makeTask();
      taskRepo.create.mockReturnValue(task);
      taskRepo.save.mockResolvedValue(task);
      customFieldService.validateTaskCustomFields.mockResolvedValue([]);

      await service.create({
        workspaceId: WS,
        projectId: PROJECT,
        statusId: 'status-todo',
        title: 'Fix bug',
        actorUserId: ACTOR,
      });

      expect(lexorank.between).toHaveBeenCalledWith(null, null);
      expect(taskRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(TaskCreatedEvent);
    });

    it('validates customFields and throws BadRequestException on invalid values', async () => {
      customFieldService.validateTaskCustomFields.mockResolvedValue([
        new BadRequestException('INVALID'),
      ]);

      await expect(
        service.create({
          workspaceId: WS,
          projectId: PROJECT,
          statusId: 'status-todo',
          title: 'Fix bug',
          customFields: { 'cf-1': 'bad-value' },
          actorUserId: ACTOR,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a status outside the target project or workspace defaults', async () => {
      statusRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          workspaceId: WS,
          projectId: PROJECT,
          statusId: 'foreign-status',
          title: 'Invalid status',
        }),
      ).rejects.toThrow('INVALID_STATUS_LINK');
    });

    it('defaults type to TaskType.TASK when not provided', async () => {
      const task = makeTask();
      taskRepo.create.mockReturnValue(task);
      taskRepo.save.mockResolvedValue(task);

      await service.create({
        workspaceId: WS,
        projectId: PROJECT,
        statusId: 'status-todo',
        title: 'No type',
        actorUserId: ACTOR,
      });

      const createCall = taskRepo.create.mock.calls[0]?.[0] as {
        type: TaskType;
      };
      expect(createCall.type).toBe(TaskType.TASK);
    });

    it('persists explicit type (BUG) for ticket creation', async () => {
      const task = makeTask({ type: TaskType.BUG });
      taskRepo.create.mockReturnValue(task);
      taskRepo.save.mockResolvedValue(task);

      await service.create({
        workspaceId: WS,
        projectId: PROJECT,
        statusId: 'status-todo',
        title: 'Crash on login',
        type: TaskType.BUG,
        actorUserId: ACTOR,
      });

      const createCall = taskRepo.create.mock.calls[0]?.[0] as {
        type: TaskType;
      };
      expect(createCall.type).toBe(TaskType.BUG);
    });

    it('enforces max nesting 2 for subtasks', async () => {
      // parentTask has a parentTaskId (is level 2) â€” cannot add child
      const parentTask = makeTask({
        id: 'parent',
        parentTaskId: 'grandparent',
      });
      taskRepo.findOne.mockResolvedValue(parentTask);

      await expect(
        service.create({
          workspaceId: WS,
          projectId: PROJECT,
          statusId: 'status-todo',
          title: 'Too deep',
          parentTaskId: 'parent',
          actorUserId: ACTOR,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(taskRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'parent', projectId: PROJECT, workspaceId: WS },
      });
    });
  });

  describe('update', () => {
    it('saves changes and emits TaskUpdatedEvent', async () => {
      const task = makeTask();
      taskRepo.findOne.mockResolvedValue(task);
      taskRepo.save.mockResolvedValue({ ...task, title: 'Updated' });

      await service.update('task-1', { title: 'Updated', actorUserId: ACTOR });

      expect(taskRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(TaskUpdatedEvent);
    });

    it('throws NotFoundException when task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('missing', { title: 'X', actorUserId: ACTOR }),
      ).rejects.toThrow(NotFoundException);
    });

    it('persists type change and includes it in TaskUpdatedEvent changes', async () => {
      const task = makeTask({ type: TaskType.TASK });
      taskRepo.findOne.mockResolvedValue(task);
      taskRepo.save.mockResolvedValue({ ...task, type: TaskType.INCIDENT });

      await service.update('task-1', {
        type: TaskType.INCIDENT,
        actorUserId: ACTOR,
      });

      const savedTask = taskRepo.save.mock.calls[0]?.[0] as { type: TaskType };
      expect(savedTask.type).toBe(TaskType.INCIDENT);

      const event = eventBus.publish.mock.calls[0]?.[0] as TaskUpdatedEvent;
      expect(event).toBeInstanceOf(TaskUpdatedEvent);
      expect(event.payload.changes).toMatchObject({ type: TaskType.INCIDENT });
    });

    it('rejects linking a sprint from another project or planning type', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      planningRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('task-1', { sprintId: 'invalid-sprint', actorUserId: ACTOR }),
      ).rejects.toThrow('INVALID_SPRINT_LINK');
      expect(planningRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'invalid-sprint', projectId: PROJECT, workspaceId: WS, type: 'sprint' },
      });
    });
  });

  describe('list', () => {
    const makeQb = (rows: TaskEntity[]) => {
      const qb: Record<string, jest.Mock> = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      return qb;
    };

    it('filters by type when provided', async () => {
      const rows = [makeTask({ type: TaskType.BUG })];
      const qb = makeQb(rows);
      taskRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.list({
        projectId: PROJECT,
        type: TaskType.BUG,
      });

      expect(result).toEqual(rows);
      const andWhereCalls = qb.andWhere.mock.calls.map((c) => c[0] as string);
      expect(andWhereCalls).toContain('task.type = :type');
      const typedCall = qb.andWhere.mock.calls.find(
        (c) => c[0] === 'task.type = :type',
      );
      expect(typedCall?.[1]).toEqual({ type: TaskType.BUG });
    });

    it('does not add type filter when not provided', async () => {
      const qb = makeQb([]);
      taskRepo.createQueryBuilder.mockReturnValue(qb);

      await service.list({ projectId: PROJECT });

      const andWhereCalls = qb.andWhere.mock.calls.map((c) => c[0] as string);
      expect(andWhereCalls).not.toContain('task.type = :type');
    });

    it('loads assignment and label ids and filters through their joins', async () => {
      const rows = [
        makeTask({
          assignments: [{ userId: 'u-2' }],
          labels: [{ labelId: 'l-3' }],
        }),
      ];
      const qb = makeQb(rows);
      taskRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.list({
        projectId: PROJECT,
        assigneeUserId: 'u-2',
        labelId: 'l-3',
      });

      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'task.assignments',
        'assignment',
      );
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('task.labels', 'taskLabel');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'assignment.user_id = :assigneeUserId',
        { assigneeUserId: 'u-2' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('taskLabel.label_id = :labelId', {
        labelId: 'l-3',
      });
      expect(result[0]?.assigneeUserIds).toEqual(['u-2']);
      expect(result[0]?.labelIds).toEqual(['l-3']);
    });
  });

  describe('changeStatus', () => {
    it('emits TaskStatusChangedEvent when switching to a non-DONE status', async () => {
      const task = makeTask({ statusId: 'status-todo' });
      taskRepo.findOne.mockResolvedValue(task);
      statusRepo.findOne.mockResolvedValue(
        makeStatus(StatusCategory.IN_PROGRESS, 'status-in-progress'),
      );
      taskRepo.save.mockResolvedValue({
        ...task,
        statusId: 'status-in-progress',
      });
      assignmentService.listAssignees.mockResolvedValue([]);

      await service.changeStatus('task-1', 'status-in-progress', ACTOR);

      expect(statusRepo.findOne).toHaveBeenCalledWith({
        where: expect.arrayContaining([
          { id: 'status-in-progress', projectId: PROJECT },
        ]),
      });
      const publishedNames = eventBus.publish.mock.calls.map(
        ([e]: [{ name: string }]) => e.name,
      );
      expect(publishedNames).toContain('task.status_changed');
      expect(publishedNames).not.toContain('task.completed');
    });

    it('emits TaskStatusChangedEvent + TaskCompletedEvent when entering DONE', async () => {
      const task = makeTask({ statusId: 'status-in-progress' });
      taskRepo.findOne.mockResolvedValue(task);
      statusRepo.findOne.mockResolvedValue(
        makeStatus(StatusCategory.DONE, 'status-done'),
      );
      taskRepo.save.mockResolvedValue({
        ...task,
        statusId: 'status-done',
        completedAt: new Date(),
      });
      assignmentService.listAssignees.mockResolvedValue([]);

      await service.changeStatus('task-1', 'status-done', ACTOR);

      const publishedNames = eventBus.publish.mock.calls.map(
        ([e]: [{ name: string }]) => e.name,
      );
      expect(publishedNames).toContain('task.status_changed');
      expect(publishedNames).toContain('task.completed');

      const completedEvent = eventBus.publish.mock.calls.find(
        ([e]: [TaskCompletedEvent]) => e instanceof TaskCompletedEvent,
      )?.[0] as TaskCompletedEvent;
      expect(completedEvent).toBeDefined();
      expect(completedEvent.payload.completedAt).toBeDefined();
    });

    it('clears completedAt when leaving DONE status', async () => {
      const task = makeTask({
        statusId: 'status-done',
        completedAt: new Date(),
      });
      taskRepo.findOne.mockResolvedValue(task);
      statusRepo.findOne.mockResolvedValue(
        makeStatus(StatusCategory.TODO, 'status-todo'),
      );
      taskRepo.save.mockResolvedValue({
        ...task,
        statusId: 'status-todo',
        completedAt: null,
      });
      assignmentService.listAssignees.mockResolvedValue([]);

      await service.changeStatus('task-1', 'status-todo', ACTOR);

      const savedTask = taskRepo.save.mock.calls[0]?.[0] as {
        completedAt: null;
      };
      expect(savedTask.completedAt).toBeNull();

      const publishedNames = eventBus.publish.mock.calls.map(
        ([e]: [{ name: string }]) => e.name,
      );
      expect(publishedNames).toContain('task.status_changed');
      expect(publishedNames).not.toContain('task.completed');
    });

    it('throws NotFoundException when status not found', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      statusRepo.findOne.mockResolvedValue(null);

      await expect(
        service.changeStatus('task-1', 'missing-status', ACTOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getById', () => {
    it('returns the task when found', async () => {
      const task = makeTask();
      taskRepo.findOne.mockResolvedValue(task);
      const result = await service.getById('task-1');
      expect(result).toEqual(task);
    });

    it('throws NotFoundException when not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.getById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('scopes a nested-route lookup to its project', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());

      await service.getById('task-1', PROJECT);

      expect(taskRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1', projectId: PROJECT },
        relations: ['subtasks', 'assignments', 'labels'],
      });
    });
  });

  describe('delete', () => {
    it('soft-deletes and emits TaskDeletedEvent', async () => {
      const task = makeTask();
      taskRepo.findOne.mockResolvedValue(task);
      taskRepo.softDelete.mockResolvedValue({ affected: 1 });

      await service.delete('task-1', ACTOR);

      expect(taskRepo.softDelete).toHaveBeenCalledWith('task-1');
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(TaskDeletedEvent);
    });
  });

  describe('reorder', () => {
    it('calls lexorank.between and saves new rank', async () => {
      const task = makeTask();
      const beforeTask = makeTask({ id: 'before', rank: 'a' });
      const afterTask = makeTask({ id: 'after', rank: 'z' });
      taskRepo.findOne
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(beforeTask)
        .mockResolvedValueOnce(afterTask);
      lexorank.between.mockReturnValue('m');
      taskRepo.save.mockResolvedValue({ ...task, rank: 'm' });

      await service.reorder('task-1', { beforeId: 'before', afterId: 'after' });

      expect(lexorank.between).toHaveBeenCalledWith('a', 'z');
      expect(taskRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ rank: 'm' }),
      );
    });
  });

  describe('listSubtasks', () => {
    it('returns tasks with matching parentTaskId', async () => {
      const subtasks = [makeTask({ parentTaskId: 'parent-task' })];
      taskRepo.find.mockResolvedValue(subtasks);

      const result = await service.listSubtasks('parent-task');
      expect(result).toEqual(subtasks);
    });
  });
});
