import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaskController, WorkspaceTaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskAssignmentService } from './task-assignment.service';
import { TaskLabelService } from './task-label.service';
import { TaskPriority, TaskType } from '@jitre/shared';

const mockTaskService = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  changeStatus: jest.fn(),
  reorder: jest.fn(),
};

const mockAssignmentService = {
  assign: jest.fn(),
  unassign: jest.fn(),
};

const mockLabelService = {
  addLabel: jest.fn(),
  removeLabel: jest.fn(),
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-1' },
  workspace: { id: 'ws-1' },
  ...overrides,
});

describe('TaskController', () => {
  let controller: TaskController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        { provide: TaskService, useValue: mockTaskService },
        { provide: TaskAssignmentService, useValue: mockAssignmentService },
        { provide: TaskLabelService, useValue: mockLabelService },
      ],
    }).compile();

    controller = module.get<TaskController>(TaskController);
  });

  describe('create — POST /projects/:projectId/tasks', () => {
    it('creates task and returns 201', async () => {
      const task = { id: 'task-1', title: 'Fix bug', projectId: 'proj-1' };
      mockTaskService.create.mockResolvedValue(task);

      const result = await controller.create(
        'proj-1',
        { title: 'Fix bug', statusId: 'status-1' },
        makeReq() as never,
      );

      expect(mockTaskService.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1', title: 'Fix bug' }),
      );
      expect(result).toEqual(task);
    });

    it('throws BadRequestException when customFields are invalid', async () => {
      mockTaskService.create.mockRejectedValue(
        new BadRequestException('INVALID'),
      );

      await expect(
        controller.create(
          'proj-1',
          { title: 'X', statusId: 's1', customFields: { bad: 'val' } },
          makeReq() as never,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('list — GET /projects/:projectId/tasks', () => {
    it('returns filtered tasks', async () => {
      const tasks = [{ id: 't1' }, { id: 't2' }];
      mockTaskService.list.mockResolvedValue(tasks);

      const result = await controller.list('proj-1', {}, makeReq() as never);
      expect(result).toEqual(tasks);
    });

    it('forwards ?type=bug as a service filter (tickets view)', async () => {
      const tickets = [{ id: 't1', type: TaskType.BUG }];
      mockTaskService.list.mockResolvedValue(tickets);

      const result = await controller.list('proj-1', { type: TaskType.BUG }, makeReq() as never);

      expect(mockTaskService.list).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1', workspaceId: 'ws-1', type: TaskType.BUG }),
      );
      expect(result).toEqual(tickets);
    });
  });

  describe('create — type propagation', () => {
    it('forwards dto.type to the service when creating a ticket', async () => {
      mockTaskService.create.mockResolvedValue({ id: 'task-2' });

      await controller.create(
        'proj-1',
        { title: 'Crash', statusId: 's1', type: TaskType.BUG },
        makeReq() as never,
      );

      expect(mockTaskService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: TaskType.BUG }),
      );
    });
  });

  describe('getById — GET /projects/:projectId/tasks/:id', () => {
    it('returns task when found', async () => {
      const task = { id: 'task-1' };
      mockTaskService.getById.mockResolvedValue(task);

      const result = await controller.getById('proj-1', 'task-1', makeReq() as never);
      expect(result).toEqual(task);
      expect(mockTaskService.getById).toHaveBeenCalledWith('task-1', 'proj-1', 'ws-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockTaskService.getById.mockRejectedValue(new NotFoundException());

      await expect(controller.getById('proj-1', 'missing', makeReq() as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update — PATCH /projects/:projectId/tasks/:id', () => {
    it('updates and returns task', async () => {
      const task = { id: 'task-1', title: 'Updated' };
      mockTaskService.update.mockResolvedValue(task);

      const result = await controller.update(
        'proj-1',
        'task-1',
        { title: 'Updated' },
        makeReq() as never,
      );
      expect(result).toEqual(task);
      expect(mockTaskService.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ title: 'Updated', actorUserId: 'user-1' }),
        'proj-1',
        'ws-1',
      );
    });
  });

  describe('delete — DELETE /projects/:projectId/tasks/:id', () => {
    it('soft-deletes task', async () => {
      mockTaskService.delete.mockResolvedValue(undefined);

      await controller.delete('proj-1', 'task-1', makeReq() as never);
      expect(mockTaskService.delete).toHaveBeenCalledWith('task-1', 'user-1', 'proj-1', 'ws-1');
    });
  });

  describe('changeStatus — PATCH /projects/:projectId/tasks/:id/status', () => {
    it('changes status', async () => {
      const task = { id: 'task-1', statusId: 'status-done' };
      mockTaskService.changeStatus.mockResolvedValue(task);

      const result = await controller.changeStatus(
        'proj-1',
        'task-1',
        { statusId: 'status-done' },
        makeReq() as never,
      );
      expect(result).toEqual(task);
      expect(mockTaskService.changeStatus).toHaveBeenCalledWith(
        'task-1',
        'status-done',
        'user-1',
        'proj-1',
        'ws-1',
      );
    });
  });

  describe('assign — POST /projects/:projectId/tasks/:id/assignees', () => {
    it('assigns user to task', async () => {
      mockAssignmentService.assign.mockResolvedValue({ id: 'a1' });

      const result = await controller.assign(
        'proj-1',
        'task-1',
        { userId: 'u2' },
        makeReq() as never,
      );
      expect(result).toBeDefined();
      expect(mockAssignmentService.assign).toHaveBeenCalledWith(
        'task-1',
        'u2',
        'user-1',
        'proj-1',
        'ws-1',
      );
    });
  });

  describe('unassign — DELETE /projects/:projectId/tasks/:id/assignees/:userId', () => {
    it('unassigns user', async () => {
      mockAssignmentService.unassign.mockResolvedValue(undefined);

      await controller.unassign('proj-1', 'task-1', 'u2', makeReq() as never);
      expect(mockAssignmentService.unassign).toHaveBeenCalledWith(
        'task-1',
        'u2',
        'user-1',
        'proj-1',
        'ws-1',
      );
    });
  });

  describe('addLabel — POST /projects/:projectId/tasks/:id/labels', () => {
    it('adds label to task', async () => {
      mockLabelService.addLabel.mockResolvedValue({ id: 'tl-1' });

      const result = await controller.addLabel(
        'proj-1',
        'task-1',
        { labelId: 'lbl-1' },
        makeReq() as never,
      );
      expect(result).toBeDefined();
      expect(mockLabelService.addLabel).toHaveBeenCalledWith(
        'task-1',
        'lbl-1',
        'user-1',
        'proj-1',
        'ws-1',
      );
    });

    it('throws BadRequestException for wrong scope label', async () => {
      mockLabelService.addLabel.mockRejectedValue(
        new BadRequestException('LABEL_SCOPE_MISMATCH'),
      );

      await expect(
        controller.addLabel(
          'proj-1',
          'task-1',
          { labelId: 'lbl-other' },
          makeReq() as never,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeLabel — DELETE /projects/:projectId/tasks/:id/labels/:labelId', () => {
    it('removes label from task', async () => {
      mockLabelService.removeLabel.mockResolvedValue(undefined);

      await controller.removeLabel(
        'proj-1',
        'task-1',
        'lbl-1',
        makeReq() as never,
      );
      expect(mockLabelService.removeLabel).toHaveBeenCalledWith(
        'task-1',
        'lbl-1',
        'user-1',
        'proj-1',
        'ws-1',
      );
    });
  });

  describe('reorder — PATCH /projects/:projectId/tasks/:id/reorder', () => {
    it('reorders task', async () => {
      const task = { id: 'task-1', rank: 'm' };
      mockTaskService.reorder.mockResolvedValue(task);

      const result = await controller.reorder(
        'proj-1',
        'task-1',
        { beforeId: 'before-id', afterId: 'after-id' },
        makeReq() as never,
      );
      expect(result).toEqual(task);
      expect(mockTaskService.reorder).toHaveBeenCalledWith(
        'task-1',
        { beforeId: 'before-id', afterId: 'after-id' },
        'proj-1',
        'ws-1',
      );
    });
  });
});

describe('WorkspaceTaskController', () => {
  let controller: WorkspaceTaskController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceTaskController],
      providers: [
        { provide: TaskService, useValue: mockTaskService },
      ],
    }).compile();

    controller = module.get<WorkspaceTaskController>(WorkspaceTaskController);
  });

  describe('getById — GET /tasks/:id', () => {
    it('returns task scoped by workspace', async () => {
      const task = { id: 'task-1', projectId: 'proj-1' };
      mockTaskService.getById.mockResolvedValue(task);

      const result = await controller.getById('task-1', makeReq() as never);

      expect(result).toEqual(task);
      expect(mockTaskService.getById).toHaveBeenCalledWith('task-1', undefined, 'ws-1');
    });
  });
});
