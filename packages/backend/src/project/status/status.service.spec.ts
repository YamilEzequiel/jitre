import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StatusService } from './status.service';
import { StatusEntity } from './status.entity';
import { StatusCategory } from '@jitre/shared';
import {
  StatusCreatedEvent,
  StatusUpdatedEvent,
  StatusDeletedEvent,
} from '../events';

const WS = 'ws-1';
const PROJECT = 'proj-1';

const makeStatus = (overrides: Partial<StatusEntity> = {}): StatusEntity =>
  ({
    id: 's1',
    workspaceId: WS,
    projectId: PROJECT,
    name: 'To Do',
    category: StatusCategory.TODO,
    isDefault: true,
    order: 0,
    color: null,
    ...overrides,
  }) as unknown as StatusEntity;

describe('StatusService', () => {
  let service: StatusService;
  let statusRepo: jest.Mocked<{
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  }>;
  let taskRepo: jest.Mocked<{
    find: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  }>;
  let dataSource: { transaction: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    statusRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    taskRepo = {
      find: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };

    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(async (cb: (em: unknown) => Promise<unknown>) => {
          const em = {
            create: jest
              .fn()
              .mockImplementation((_cls: unknown, data: unknown) => data),
            save: jest
              .fn()
              .mockImplementation((_cls: unknown, data: unknown) =>
                Promise.resolve({ ...((data as object) ?? {}), id: 'new-s' }),
              ),
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            count: jest.fn().mockResolvedValue(0),
          };
          return cb(em);
        }),
    };

    eventBus = { publish: jest.fn() };

    service = new StatusService(
      statusRepo as never,
      taskRepo as never,
      dataSource as never,
      eventBus as never,
    );
  });

  describe('ensureDefaults', () => {
    it('inserts exactly 4 default statuses in a transaction', async () => {
      let savedCount = 0;
      dataSource.transaction.mockImplementation(
        async (cb: (em: unknown) => Promise<unknown>) => {
          const em = {
            create: jest
              .fn()
              .mockImplementation((_cls: unknown, data: unknown) => data),
            save: jest.fn().mockImplementation(() => {
              savedCount++;
              return Promise.resolve({ id: `s${savedCount}` });
            }),
          };
          return cb(em);
        },
      );

      await service.ensureDefaults(PROJECT, WS);
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(savedCount).toBe(4);
    });

    it('seeds exactly one isDefault=true row', async () => {
      const saved: Array<{ isDefault?: boolean }> = [];
      dataSource.transaction.mockImplementation(
        async (cb: (em: unknown) => Promise<unknown>) => {
          const em = {
            create: jest
              .fn()
              .mockImplementation((_cls: unknown, data: unknown) => data),
            save: jest
              .fn()
              .mockImplementation((_cls: unknown, data: unknown) => {
                saved.push(data as { isDefault?: boolean });
                return Promise.resolve({ id: `s${saved.length}` });
              }),
          };
          return cb(em);
        },
      );

      await service.ensureDefaults(PROJECT, WS);
      const defaults = saved.filter((s) => s.isDefault === true);
      expect(defaults).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('saves status and emits StatusCreatedEvent', async () => {
      const created = makeStatus({ id: 'new-s' });
      statusRepo.create.mockReturnValue(created);
      statusRepo.save.mockResolvedValue(created);

      await service.create({
        workspaceId: WS,
        projectId: PROJECT,
        name: 'To Do',
        category: StatusCategory.TODO,
        isDefault: true,
        order: 0,
        color: null,
        actorUserId: 'u1',
      });

      expect(statusRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(StatusCreatedEvent);
    });
  });

  describe('update', () => {
    it('saves updated status and emits StatusUpdatedEvent', async () => {
      const existing = makeStatus();
      statusRepo.findOne.mockResolvedValue(existing);
      statusRepo.save.mockResolvedValue({ ...existing, name: 'In Progress' });

      await service.update('s1', WS, { name: 'In Progress', actorUserId: 'u1' });

      expect(statusRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(StatusUpdatedEvent);
    });

    it('throws NotFoundException when status not found', async () => {
      statusRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('missing', WS, { name: 'X', actorUserId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('moves referencing tasks to replacement and then deletes status', async () => {
      const existing = makeStatus();
      statusRepo.findOne
        .mockResolvedValueOnce(existing) // load target
        .mockResolvedValueOnce(
          makeStatus({ id: 'replace-s', isDefault: false }),
        ); // load replacement

      taskRepo.count.mockResolvedValue(2); // 2 tasks reference this status
      taskRepo.update.mockResolvedValue({ affected: 2 });
      statusRepo.delete.mockResolvedValue({ affected: 1 });

      await service.delete('s1', WS, {
        replaceWithStatusId: 'replace-s',
        actorUserId: 'u1',
      });

      expect(taskRepo.update).toHaveBeenCalledWith(
        { statusId: 's1', workspaceId: WS },
        { statusId: 'replace-s' },
      );
      expect(statusRepo.delete).toHaveBeenCalledWith('s1');
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(StatusDeletedEvent);
    });

    it('throws BadRequestException when tasks reference the status but no replaceWithStatusId', async () => {
      const existing = makeStatus();
      statusRepo.findOne.mockResolvedValue(existing);
      taskRepo.count.mockResolvedValue(3);

      await expect(service.delete('s1', WS, { actorUserId: 'u1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deletes cleanly when no tasks reference the status', async () => {
      statusRepo.findOne.mockResolvedValue(makeStatus());
      taskRepo.count.mockResolvedValue(0);
      statusRepo.delete.mockResolvedValue({ affected: 1 });

      await service.delete('s1', WS, { actorUserId: 'u1' });
      expect(statusRepo.delete).toHaveBeenCalledWith('s1');
    });

    it('throws NotFoundException when status not found', async () => {
      statusRepo.findOne.mockResolvedValue(null);
      await expect(
        service.delete('missing', WS, { actorUserId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listByProject', () => {
    it('returns project-specific statuses', async () => {
      const projectStatuses = [makeStatus()];
      statusRepo.find.mockResolvedValueOnce(projectStatuses);

      const result = await service.listByProject(PROJECT, WS);
      expect(result).toEqual(projectStatuses);
    });

    it('falls back to workspace defaults when no project statuses', async () => {
      const wsDefaults = [makeStatus({ projectId: null })];
      statusRepo.find
        .mockResolvedValueOnce([]) // no project statuses
        .mockResolvedValueOnce(wsDefaults); // workspace defaults

      const result = await service.listByProject(PROJECT, WS);
      expect(result).toEqual(wsDefaults);
    });
  });

  describe('listByWorkspace', () => {
    it('returns workspace catalog statuses (projectId IS NULL)', async () => {
      const wsStatuses = [makeStatus({ projectId: null })];
      statusRepo.find.mockResolvedValue(wsStatuses);

      const result = await service.listByWorkspace(WS);
      expect(result).toEqual(wsStatuses);
    });
  });
});
