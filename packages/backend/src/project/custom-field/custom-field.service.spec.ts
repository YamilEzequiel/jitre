import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomFieldService } from './custom-field.service';
import { CustomFieldEntity } from './custom-field.entity';
import { CustomFieldType, CustomFieldScope } from '@jitre/shared';
import {
  CustomFieldCreatedEvent,
  CustomFieldUpdatedEvent,
  CustomFieldDeletedEvent,
} from '../events';

const WS = 'ws-1';
const PROJECT = 'proj-1';

const makeField = (
  overrides: Partial<CustomFieldEntity> = {},
): CustomFieldEntity =>
  ({
    id: 'cf-1',
    workspaceId: WS,
    name: 'Priority',
    type: CustomFieldType.SELECT,
    options: ['Low', 'Medium', 'High'],
    required: false,
    scope: CustomFieldScope.WORKSPACE,
    projectId: null,
    ...overrides,
  }) as unknown as CustomFieldEntity;

describe('CustomFieldService', () => {
  let service: CustomFieldService;
  let fieldRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    fieldRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };

    service = new CustomFieldService(fieldRepo as never, eventBus as never);
  });

  describe('create', () => {
    it('saves and emits CustomFieldCreatedEvent', async () => {
      const field = makeField();
      fieldRepo.create.mockReturnValue(field);
      fieldRepo.save.mockResolvedValue(field);

      await service.create({
        workspaceId: WS,
        name: 'Priority',
        type: CustomFieldType.SELECT,
        options: ['Low', 'Medium', 'High'],
        required: false,
        actorUserId: 'u1',
      });

      expect(fieldRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(CustomFieldCreatedEvent);
    });

    it('throws BadRequestException for SELECT type without options', async () => {
      await expect(
        service.create({
          workspaceId: WS,
          name: 'Status',
          type: CustomFieldType.SELECT,
          required: false,
          actorUserId: 'u1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for MULTI_SELECT type without options', async () => {
      await expect(
        service.create({
          workspaceId: WS,
          name: 'Tags',
          type: CustomFieldType.MULTI_SELECT,
          required: false,
          actorUserId: 'u1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('saves updated field and emits CustomFieldUpdatedEvent', async () => {
      const existing = makeField();
      fieldRepo.findOne.mockResolvedValue(existing);
      fieldRepo.save.mockResolvedValue({ ...existing, name: 'Severity' });

      await service.update('cf-1', WS, { name: 'Severity', actorUserId: 'u1' });

      expect(fieldRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(CustomFieldUpdatedEvent);
    });

    it('throws NotFoundException when field not found', async () => {
      fieldRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('missing', WS, { name: 'X', actorUserId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes field and emits CustomFieldDeletedEvent', async () => {
      fieldRepo.findOne.mockResolvedValue(makeField());
      fieldRepo.delete.mockResolvedValue({ affected: 1 });

      await service.delete('cf-1', WS, { actorUserId: 'u1' });

      expect(fieldRepo.delete).toHaveBeenCalledWith('cf-1');
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(CustomFieldDeletedEvent);
    });

    it('throws NotFoundException when field not found', async () => {
      fieldRepo.findOne.mockResolvedValue(null);
      await expect(
        service.delete('missing', WS, { actorUserId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('filters by projectId when provided', async () => {
      const fields = [makeField({ projectId: PROJECT })];
      fieldRepo.find.mockResolvedValue(fields);

      const result = await service.list({ projectId: PROJECT, workspaceId: WS });
      expect(result).toEqual(fields);
    });

    it('returns workspace fields when no projectId', async () => {
      const fields = [makeField()];
      fieldRepo.find.mockResolvedValue(fields);

      const result = await service.list({ workspaceId: WS });
      expect(result).toEqual(fields);
    });
  });

  describe('validateTaskCustomFields', () => {
    it('returns no errors for valid field values', async () => {
      const definitions = [makeField()];
      fieldRepo.find.mockResolvedValue(definitions);

      const errors = await service.validateTaskCustomFields('proj-1', WS, {
        'cf-1': 'Low',
      });

      expect(errors).toHaveLength(0);
    });

    it('returns errors for unknown fieldId', async () => {
      fieldRepo.find.mockResolvedValue([]);

      const errors = await service.validateTaskCustomFields('proj-1', WS, {
        'unknown-id': 'anything',
      });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns errors for invalid value type', async () => {
      const definitions = [
        makeField({
          type: CustomFieldType.NUMBER,
          required: false,
          options: null,
        }),
      ];
      fieldRepo.find.mockResolvedValue(definitions);

      const errors = await service.validateTaskCustomFields('proj-1', WS, {
        'cf-1': 'not-a-number',
      });

      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
