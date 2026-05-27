import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectEntity } from './project.entity';
import { ProjectStatus, ProjectRole } from '@jitre/shared';
import {
  ProjectCreatedEvent,
  ProjectUpdatedEvent,
  ProjectArchivedEvent,
} from './events';

const WS = 'ws-1';
const OWNER = 'user-owner';

const makeProject = (overrides: Partial<ProjectEntity> = {}): ProjectEntity =>
  ({
    id: 'proj-1',
    workspaceId: WS,
    name: 'My Project',
    key: 'MYPRJ',
    description: null,
    status: ProjectStatus.ACTIVE,
    ownerUserId: OWNER,
    color: null,
    icon: null,
    startDate: null,
    targetDate: null,
    category: null,
    framework: null,
    database: null,
    customerName: null,
    repositoryUrl: null,
    ...overrides,
  }) as unknown as ProjectEntity;

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
  };
  let membershipService: {
    addMember: jest.Mock;
  };
  let statusService: {
    ensureDefaults: jest.Mock;
  };
  let chatService: {
    ensureProjectChannel: jest.Mock;
  };
  let taskRepo: {
    count: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    projectRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
    };

    membershipService = {
      addMember: jest
        .fn()
        .mockResolvedValue({ id: 'm1', role: ProjectRole.ADMIN }),
    };

    statusService = {
      ensureDefaults: jest.fn().mockResolvedValue([]),
    };
    chatService = {
      ensureProjectChannel: jest.fn().mockResolvedValue({ id: 'chat-proj-1' }),
    };

    taskRepo = {
      count: jest.fn().mockResolvedValue(0),
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
                Promise.resolve({ ...((data as object) ?? {}), id: 'proj-1' }),
              ),
          };
          return cb(em);
        }),
    };

    eventBus = { publish: jest.fn() };

    service = new ProjectService(
      projectRepo as never,
      taskRepo as never,
      membershipService as never,
      statusService as never,
      chatService as never,
      dataSource as never,
      eventBus as never,
    );
  });

  describe('create', () => {
    it('runs in a single transaction and emits ProjectCreatedEvent + ProjectMemberAddedEvent', async () => {
      const project = makeProject();

      dataSource.transaction.mockImplementation(
        async (cb: (em: unknown) => Promise<unknown>) => {
          const em = {
            create: jest.fn().mockReturnValue(project),
            save: jest.fn().mockResolvedValue(project),
          };
          return cb(em);
        },
      );

      await service.create({
        workspaceId: WS,
        name: 'My Project',
        key: 'MYPRJ',
        ownerUserId: OWNER,
      });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(membershipService.addMember).toHaveBeenCalledWith(
        'proj-1',
        WS,
        OWNER,
        ProjectRole.ADMIN,
        OWNER,
      );
      expect(statusService.ensureDefaults).toHaveBeenCalledWith('proj-1', WS);
      expect(chatService.ensureProjectChannel).toHaveBeenCalledWith({
        workspaceId: WS,
        projectId: 'proj-1',
        projectName: 'My Project',
        actorUserId: OWNER,
        memberUserIds: [OWNER],
      });

      const publishedNames = eventBus.publish.mock.calls.map(
        ([event]: [{ name: string }]) => event.name,
      );
      expect(publishedNames).toContain('project.created');

      const createdEvent = eventBus.publish.mock.calls.find(
        ([e]: [ProjectCreatedEvent]) => e instanceof ProjectCreatedEvent,
      )?.[0];
      expect(createdEvent).toBeDefined();
    });

    it('persists the optional metadata fields when provided', async () => {
      const emCreate = jest
        .fn()
        .mockImplementation((_cls: unknown, data: unknown) => data);
      const emSave = jest
        .fn()
        .mockImplementation((_cls: unknown, data: unknown) =>
          Promise.resolve({ ...((data as object) ?? {}), id: 'proj-1' }),
        );

      dataSource.transaction.mockImplementation(
        async (cb: (em: unknown) => Promise<unknown>) => {
          const em = { create: emCreate, save: emSave };
          return cb(em);
        },
      );

      await service.create({
        workspaceId: WS,
        name: 'My Project',
        key: 'MYPRJ',
        ownerUserId: OWNER,
        category: 'Internal',
        framework: 'NestJS',
        database: 'PostgreSQL',
        customerName: 'Acme Corp',
        repositoryUrl: 'https://github.com/acme/proj',
      });

      expect(emCreate).toHaveBeenCalledWith(
        ProjectEntity,
        expect.objectContaining({
          category: 'Internal',
          framework: 'NestJS',
          database: 'PostgreSQL',
          customerName: 'Acme Corp',
          repositoryUrl: 'https://github.com/acme/proj',
        }),
      );
    });

    it('stores nulls for metadata when none are provided', async () => {
      const emCreate = jest
        .fn()
        .mockImplementation((_cls: unknown, data: unknown) => data);
      const emSave = jest
        .fn()
        .mockImplementation((_cls: unknown, data: unknown) =>
          Promise.resolve({ ...((data as object) ?? {}), id: 'proj-1' }),
        );

      dataSource.transaction.mockImplementation(
        async (cb: (em: unknown) => Promise<unknown>) => {
          const em = { create: emCreate, save: emSave };
          return cb(em);
        },
      );

      await service.create({
        workspaceId: WS,
        name: 'My Project',
        key: 'MYPRJ',
        ownerUserId: OWNER,
      });

      expect(emCreate).toHaveBeenCalledWith(
        ProjectEntity,
        expect.objectContaining({
          category: null,
          framework: null,
          database: null,
          customerName: null,
          repositoryUrl: null,
        }),
      );
    });
  });

  describe('update', () => {
    it('saves changes and emits ProjectUpdatedEvent', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      projectRepo.save.mockResolvedValue({ ...project, name: 'Updated' });

      await service.update('proj-1', WS, { name: 'Updated', actorUserId: OWNER });

      expect(projectRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(ProjectUpdatedEvent);
    });

    it('throws NotFoundException when project not found', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('missing', WS, { name: 'X', actorUserId: OWNER }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates the optional metadata fields', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      projectRepo.save.mockImplementation((p: ProjectEntity) =>
        Promise.resolve(p),
      );

      const saved = await service.update('proj-1', WS, {
        category: 'Client',
        framework: 'Angular',
        database: 'PostgreSQL',
        customerName: 'Acme Corp',
        repositoryUrl: 'https://github.com/acme/proj',
        actorUserId: OWNER,
      });

      expect(saved.category).toBe('Client');
      expect(saved.framework).toBe('Angular');
      expect(saved.database).toBe('PostgreSQL');
      expect(saved.customerName).toBe('Acme Corp');
      expect(saved.repositoryUrl).toBe('https://github.com/acme/proj');
    });

    it('clears metadata fields when explicitly set to null', async () => {
      const project = makeProject({
        category: 'Internal',
        framework: 'NestJS',
        database: 'PostgreSQL',
        customerName: 'Acme Corp',
        repositoryUrl: 'https://github.com/acme/proj',
      });
      projectRepo.findOne.mockResolvedValue(project);
      projectRepo.save.mockImplementation((p: ProjectEntity) =>
        Promise.resolve(p),
      );

      const saved = await service.update('proj-1', WS, {
        category: null,
        framework: null,
        database: null,
        customerName: null,
        repositoryUrl: null,
        actorUserId: OWNER,
      });

      expect(saved.category).toBeNull();
      expect(saved.framework).toBeNull();
      expect(saved.database).toBeNull();
      expect(saved.customerName).toBeNull();
      expect(saved.repositoryUrl).toBeNull();
    });

    it('leaves metadata untouched when fields are omitted from the update DTO', async () => {
      const project = makeProject({
        category: 'Internal',
        framework: 'NestJS',
        database: 'PostgreSQL',
        customerName: 'Acme Corp',
        repositoryUrl: 'https://github.com/acme/proj',
      });
      projectRepo.findOne.mockResolvedValue(project);
      projectRepo.save.mockImplementation((p: ProjectEntity) =>
        Promise.resolve(p),
      );

      const saved = await service.update('proj-1', WS, {
        name: 'Renamed',
        actorUserId: OWNER,
      });

      expect(saved.name).toBe('Renamed');
      expect(saved.category).toBe('Internal');
      expect(saved.framework).toBe('NestJS');
      expect(saved.database).toBe('PostgreSQL');
      expect(saved.customerName).toBe('Acme Corp');
      expect(saved.repositoryUrl).toBe('https://github.com/acme/proj');
    });
  });

  describe('archive', () => {
    it('archives project and emits ProjectArchivedEvent when no active tasks', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      taskRepo.count.mockResolvedValue(0);
      projectRepo.save.mockResolvedValue({
        ...project,
        status: ProjectStatus.ARCHIVED,
      });

      await service.archive('proj-1', WS, { actorUserId: OWNER });

      expect(projectRepo.save).toHaveBeenCalled();
      const event = eventBus.publish.mock.calls[0]?.[0];
      expect(event).toBeInstanceOf(ProjectArchivedEvent);
    });

    it('throws ConflictException (409) when active tasks exist', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);
      taskRepo.count.mockResolvedValue(5); // active tasks

      await expect(
        service.archive('proj-1', WS, { actorUserId: OWNER }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when project not found', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(
        service.archive('missing', WS, { actorUserId: OWNER }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getById', () => {
    it('returns the project when found', async () => {
      const project = makeProject();
      projectRepo.findOne.mockResolvedValue(project);

      const result = await service.getById('proj-1', WS);
      expect(result).toEqual(project);
      expect(projectRepo.findOne).toHaveBeenCalledWith({ where: { id: 'proj-1', workspaceId: WS } });
    });

    it('throws NotFoundException when not found', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.getById('missing', WS)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('returns projects for the workspace', async () => {
      const projects = [makeProject()];
      projectRepo.find.mockResolvedValue(projects);

      const result = await service.list(WS);
      expect(result).toEqual(projects);
    });
  });
});
