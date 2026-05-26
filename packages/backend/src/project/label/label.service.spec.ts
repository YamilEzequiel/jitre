import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LabelService } from './label.service';
import { LabelEntity } from './label.entity';
import { LabelScope } from '@jitre/shared';
import {
  LabelCreatedEvent,
  LabelUpdatedEvent,
  LabelDeletedEvent,
} from '../events';

const WS = 'ws-1';
const PROJECT = 'proj-1';

const makeLabel = (overrides: Partial<LabelEntity> = {}): LabelEntity =>
  ({
    id: 'lbl-1',
    workspaceId: WS,
    name: 'Bug',
    color: '#ff0000',
    scope: LabelScope.WORKSPACE,
    projectId: null,
    ...overrides,
  }) as unknown as LabelEntity;

describe('LabelService', () => {
  let service: LabelService;
  let labelRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let taskLabelRepo: { delete: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    labelRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    taskLabelRepo = { delete: jest.fn() };
    eventBus = { publish: jest.fn() };

    service = new LabelService(
      labelRepo as never,
      taskLabelRepo as never,
      eventBus as never,
    );
  });

  describe('create', () => {
    it('WORKSPACE scope: projectId must be null', async () => {
      const label = makeLabel();
      labelRepo.create.mockReturnValue(label);
      labelRepo.save.mockResolvedValue(label);

      await service.create({
        workspaceId: WS,
        name: 'Bug',
        scope: LabelScope.WORKSPACE,
        actorUserId: 'u1',
      });

      expect(labelRepo.save).toHaveBeenCalled();
      const saved = labelRepo.create.mock.calls[0]?.[0] as { projectId: null };
      expect(saved.projectId).toBeNull();
    });

    it('PROJECT scope: projectId required', async () => {
      const label = makeLabel({
        scope: LabelScope.PROJECT,
        projectId: PROJECT,
      });
      labelRepo.create.mockReturnValue(label);
      labelRepo.save.mockResolvedValue(label);

      await service.create({
        workspaceId: WS,
        projectId: PROJECT,
        name: 'Feature',
        scope: LabelScope.PROJECT,
        actorUserId: 'u1',
      });

      expect(labelRepo.save).toHaveBeenCalled();
    });

    it('PROJECT scope without projectId throws BadRequestException', async () => {
      await expect(
        service.create({
          workspaceId: WS,
          name: 'X',
          scope: LabelScope.PROJECT,
          actorUserId: 'u1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('WORKSPACE scope with projectId throws BadRequestException', async () => {
      await expect(
        service.create({
          workspaceId: WS,
          projectId: PROJECT,
          name: 'X',
          scope: LabelScope.WORKSPACE,
          actorUserId: 'u1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('emits LabelCreatedEvent', async () => {
      const label = makeLabel();
      labelRepo.create.mockReturnValue(label);
      labelRepo.save.mockResolvedValue(label);

      await service.create({
        workspaceId: WS,
        name: 'Bug',
        scope: LabelScope.WORKSPACE,
        actorUserId: 'u1',
      });

      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(LabelCreatedEvent);
    });
  });

  describe('update', () => {
    it('saves updated label and emits LabelUpdatedEvent', async () => {
      const existing = makeLabel();
      labelRepo.findOne.mockResolvedValue(existing);
      labelRepo.save.mockResolvedValue({ ...existing, name: 'Feature' });

      await service.update('lbl-1', WS, { name: 'Feature', actorUserId: 'u1' });

      expect(labelRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(LabelUpdatedEvent);
    });

    it('throws NotFoundException when label not found', async () => {
      labelRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('missing', WS, { name: 'X', actorUserId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('cascades TaskLabel rows then deletes label and emits LabelDeletedEvent', async () => {
      const existing = makeLabel();
      labelRepo.findOne.mockResolvedValue(existing);
      taskLabelRepo.delete.mockResolvedValue({ affected: 3 });
      labelRepo.delete.mockResolvedValue({ affected: 1 });

      await service.delete('lbl-1', WS, { actorUserId: 'u1' });

      expect(taskLabelRepo.delete).toHaveBeenCalledWith({ labelId: 'lbl-1', workspaceId: WS });
      expect(labelRepo.delete).toHaveBeenCalledWith('lbl-1');
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(LabelDeletedEvent);
    });

    it('throws NotFoundException when label not found', async () => {
      labelRepo.findOne.mockResolvedValue(null);
      await expect(
        service.delete('missing', WS, { actorUserId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listByWorkspace', () => {
    it('returns workspace-scoped labels', async () => {
      const labels = [makeLabel()];
      labelRepo.find.mockResolvedValue(labels);

      const result = await service.listByWorkspace(WS);
      expect(result).toEqual(labels);
      expect(labelRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: WS }),
        }),
      );
    });
  });

  describe('listByProject', () => {
    it('returns project-scoped labels', async () => {
      const labels = [
        makeLabel({ scope: LabelScope.PROJECT, projectId: PROJECT }),
      ];
      labelRepo.find.mockResolvedValue(labels);

      const result = await service.listByProject(PROJECT, WS);
      expect(result).toEqual(labels);
    });
  });
});
