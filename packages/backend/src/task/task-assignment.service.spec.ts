import { NotFoundException } from '@nestjs/common';
import { TaskAssignmentService } from './task-assignment.service';
import { TaskAssignmentEntity } from './task-assignment.entity';
import { TaskAssignedEvent, TaskUnassignedEvent } from './events';

const TASK = 'task-1';
const USER = 'user-1';
const ACTOR = 'actor-1';
const WS = 'ws-1';
const PROJECT = 'proj-1';

const makeAssignment = (
  overrides: Partial<TaskAssignmentEntity> = {},
): TaskAssignmentEntity =>
  ({
    id: 'a1',
    workspaceId: WS,
    taskId: TASK,
    userId: USER,
    assignedByUserId: ACTOR,
    assignedAt: new Date(),
    ...overrides,
  }) as unknown as TaskAssignmentEntity;

const makeTask = () => ({ id: TASK, workspaceId: WS, projectId: PROJECT });

describe('TaskAssignmentService', () => {
  let service: TaskAssignmentService;
  let assignmentRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let taskRepo: { findOne: jest.Mock };
  let membershipRepo: { findOne: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    assignmentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    taskRepo = { findOne: jest.fn() };
    membershipRepo = { findOne: jest.fn() };
    eventBus = { publish: jest.fn() };

    service = new TaskAssignmentService(
      assignmentRepo as never,
      taskRepo as never,
      membershipRepo as never,
      eventBus as never,
    );
  });

  describe('assign', () => {
    it('saves a new assignment and emits TaskAssignedEvent', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      membershipRepo.findOne.mockResolvedValue({
        userId: USER,
        projectId: PROJECT,
      });
      assignmentRepo.findOne.mockResolvedValue(null);
      const assignment = makeAssignment();
      assignmentRepo.create.mockReturnValue(assignment);
      assignmentRepo.save.mockResolvedValue(assignment);

      await service.assign(TASK, USER, ACTOR);

      expect(assignmentRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(TaskAssignedEvent);
    });

    it('throws NotFoundException when task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.assign('missing', USER, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('scopes assignment from a nested route to the requested project', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(service.assign(TASK, USER, ACTOR, PROJECT)).rejects.toThrow(
        'TASK_NOT_FOUND',
      );
      expect(taskRepo.findOne).toHaveBeenCalledWith({
        where: { id: TASK, projectId: PROJECT },
      });
    });

    it('rejects assigning a user who is not a project member', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(service.assign(TASK, 'outside-user', ACTOR)).rejects.toThrow(
        'PROJECT_MEMBERSHIP_NOT_FOUND',
      );
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('is idempotent when already assigned (returns existing without error)', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      membershipRepo.findOne.mockResolvedValue({ userId: USER });
      const existing = makeAssignment();
      assignmentRepo.findOne.mockResolvedValue(existing);

      // Should not throw
      await expect(service.assign(TASK, USER, ACTOR)).resolves.toBeDefined();
      expect(membershipRepo.findOne).toHaveBeenCalledWith({
        where: { projectId: PROJECT, workspaceId: WS, userId: USER },
      });
      // Should not save again
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('unassign', () => {
    it('deletes assignment and emits TaskUnassignedEvent', async () => {
      const assignment = makeAssignment();
      assignmentRepo.findOne.mockResolvedValue(assignment);
      taskRepo.findOne.mockResolvedValue(makeTask());
      assignmentRepo.delete.mockResolvedValue({ affected: 1 });

      await service.unassign(TASK, USER, ACTOR);

      expect(assignmentRepo.delete).toHaveBeenCalledWith({
        taskId: TASK,
        userId: USER,
        workspaceId: WS,
      });
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(TaskUnassignedEvent);
    });

    it('throws NotFoundException when assignment not found', async () => {
      assignmentRepo.findOne.mockResolvedValue(null);
      await expect(service.unassign(TASK, USER, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listAssignees', () => {
    it('returns assignments for the task', async () => {
      const assignments = [makeAssignment()];
      assignmentRepo.find.mockResolvedValue(assignments);

      const result = await service.listAssignees(TASK);
      expect(result).toEqual(assignments);
    });
  });
});
