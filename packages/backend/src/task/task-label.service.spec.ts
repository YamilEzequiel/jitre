import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskLabelService } from './task-label.service';
import { TaskLabelEntity } from './task-label.entity';
import { LabelScope } from '@jitre/shared';
import { TaskLabelAddedEvent, TaskLabelRemovedEvent } from './events';

const TASK = 'task-1';
const LABEL = 'lbl-1';
const WS = 'ws-1';
const PROJECT = 'proj-1';
const ACTOR = 'user-1';

const makeTask = (overrides = {}) => ({
  id: TASK,
  workspaceId: WS,
  projectId: PROJECT,
  ...overrides,
});

const makeLabel = (overrides = {}) => ({
  id: LABEL,
  workspaceId: WS,
  name: 'Bug',
  scope: LabelScope.WORKSPACE,
  projectId: null,
  ...overrides,
});

const makeTaskLabel = (
  overrides: Partial<TaskLabelEntity> = {},
): TaskLabelEntity =>
  ({
    id: 'tl-1',
    workspaceId: WS,
    taskId: TASK,
    labelId: LABEL,
    ...overrides,
  }) as unknown as TaskLabelEntity;

describe('TaskLabelService', () => {
  let service: TaskLabelService;
  let taskLabelRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let taskRepo: { findOne: jest.Mock };
  let labelRepo: { findOne: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    taskLabelRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    taskRepo = { findOne: jest.fn() };
    labelRepo = { findOne: jest.fn() };
    eventBus = { publish: jest.fn() };

    service = new TaskLabelService(
      taskLabelRepo as never,
      taskRepo as never,
      labelRepo as never,
      eventBus as never,
    );
  });

  describe('addLabel', () => {
    it('adds a WORKSPACE-scoped label to any task and emits TaskLabelAddedEvent', async () => {
      const task = makeTask();
      const label = makeLabel({ scope: LabelScope.WORKSPACE });
      taskRepo.findOne.mockResolvedValue(task);
      labelRepo.findOne.mockResolvedValue(label);
      taskLabelRepo.findOne.mockResolvedValue(null);
      const tl = makeTaskLabel();
      taskLabelRepo.create.mockReturnValue(tl);
      taskLabelRepo.save.mockResolvedValue(tl);

      await service.addLabel(TASK, LABEL, ACTOR);

      expect(labelRepo.findOne).toHaveBeenCalledWith({
        where: { id: LABEL, workspaceId: WS },
      });
      expect(taskLabelRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(TaskLabelAddedEvent);
    });

    it('adds a PROJECT-scoped label when label.projectId matches task.projectId', async () => {
      const task = makeTask();
      const label = makeLabel({
        scope: LabelScope.PROJECT,
        projectId: PROJECT,
      });
      taskRepo.findOne.mockResolvedValue(task);
      labelRepo.findOne.mockResolvedValue(label);
      taskLabelRepo.findOne.mockResolvedValue(null);
      const tl = makeTaskLabel();
      taskLabelRepo.create.mockReturnValue(tl);
      taskLabelRepo.save.mockResolvedValue(tl);

      await service.addLabel(TASK, LABEL, ACTOR);
      expect(taskLabelRepo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when PROJECT-scoped label belongs to a different project', async () => {
      const task = makeTask({ projectId: 'proj-1' });
      const label = makeLabel({
        scope: LabelScope.PROJECT,
        projectId: 'proj-OTHER',
      });
      taskRepo.findOne.mockResolvedValue(task);
      labelRepo.findOne.mockResolvedValue(label);

      await expect(service.addLabel(TASK, LABEL, ACTOR)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.addLabel('missing', LABEL, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('scopes label mutation from a nested route to the requested project', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(service.addLabel(TASK, LABEL, ACTOR, PROJECT)).rejects.toThrow(
        'TASK_NOT_FOUND',
      );
      expect(taskRepo.findOne).toHaveBeenCalledWith({
        where: { id: TASK, projectId: PROJECT },
      });
    });

    it('throws NotFoundException when label not found', async () => {
      taskRepo.findOne.mockResolvedValue(makeTask());
      labelRepo.findOne.mockResolvedValue(null);
      await expect(service.addLabel(TASK, 'missing', ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeLabel', () => {
    it('deletes task-label and emits TaskLabelRemovedEvent', async () => {
      const tl = makeTaskLabel();
      taskLabelRepo.findOne.mockResolvedValue(tl);
      taskRepo.findOne.mockResolvedValue(makeTask());
      taskLabelRepo.delete.mockResolvedValue({ affected: 1 });

      await service.removeLabel(TASK, LABEL, ACTOR);

      expect(taskLabelRepo.delete).toHaveBeenCalledWith({
        taskId: TASK,
        labelId: LABEL,
        workspaceId: WS,
      });
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(TaskLabelRemovedEvent);
    });

    it('throws NotFoundException when task-label not found', async () => {
      taskLabelRepo.findOne.mockResolvedValue(null);
      await expect(
        service.removeLabel(TASK, 'missing-label', ACTOR),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
