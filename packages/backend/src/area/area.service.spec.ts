import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AreaService } from './area.service';
import { AreaEntity } from './area.entity';
import { UserEntity } from '../user/user.entity';
import { ProjectEntity } from '../project/project.entity';
import { DEFAULT_AREA_COLOR } from './dto/create-area.dto';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeArea(overrides: Partial<AreaEntity> = {}): AreaEntity {
  return {
    id: 'A1',
    workspaceId: 'W1',
    name: 'Engineering',
    color: '#7c3aed',
    icon: null,
    description: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    createdBy: 'U-ADMIN',
    updatedBy: 'U-ADMIN',
    version: 1,
    ...overrides,
  } as AreaEntity;
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

let areaRepo: {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};
let userRepo: { find: jest.Mock };
let projectRepo: { find: jest.Mock };

const entityManager = {
  update: jest.fn(),
  softDelete: jest.fn(),
};

const dataSource: { transaction: jest.Mock } = {
  transaction: jest.fn(),
};

describe('AreaService', () => {
  let service: AreaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    areaRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    userRepo = { find: jest.fn() };
    projectRepo = { find: jest.fn() };

    entityManager.update.mockReset();
    entityManager.softDelete.mockReset();
    dataSource.transaction.mockReset();
    dataSource.transaction.mockImplementation(
      (cb: (em: typeof entityManager) => unknown) => cb(entityManager),
    );

    const module = await Test.createTestingModule({
      providers: [
        AreaService,
        { provide: getRepositoryToken(AreaEntity), useValue: areaRepo },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        { provide: getRepositoryToken(ProjectEntity), useValue: projectRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(AreaService);
  });

  // ── list ──────────────────────────────────────────────────────────────────
  describe('list()', () => {
    it('returns active areas ordered by name ASC, scoped to the workspace', async () => {
      const a1 = makeArea({ id: 'A1', name: 'Design' });
      const a2 = makeArea({ id: 'A2', name: 'Engineering' });
      areaRepo.find.mockResolvedValueOnce([a1, a2]);

      const result = await service.list('W1');

      expect(result).toEqual([a1, a2]);
      expect(areaRepo.find).toHaveBeenCalledWith({
        where: { workspaceId: 'W1', deletedAt: expect.anything() },
        order: { name: 'ASC' },
      });
    });
  });

  // ── get ───────────────────────────────────────────────────────────────────
  describe('get()', () => {
    it('returns the area when found', async () => {
      const area = makeArea();
      areaRepo.findOne.mockResolvedValueOnce(area);

      const result = await service.get('A1', 'W1');

      expect(result).toBe(area);
      expect(areaRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: 'A1',
          workspaceId: 'W1',
          deletedAt: expect.anything(),
        },
      });
    });

    it('throws NotFoundException("AREA_NOT_FOUND") when missing', async () => {
      areaRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.get('A1', 'W1')).rejects.toThrow(NotFoundException);
      await expect(service.get('A1', 'W1')).rejects.toThrow('AREA_NOT_FOUND');
    });
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('create()', () => {
    it('creates an area with defaulted color when none provided', async () => {
      areaRepo.findOne.mockResolvedValueOnce(null); // name available
      const created = makeArea({ id: 'A-NEW', name: 'Sales' });
      areaRepo.create.mockReturnValueOnce(created);
      areaRepo.save.mockResolvedValueOnce(created);

      const result = await service.create(
        'W1',
        { name: 'Sales' } as Parameters<typeof service.create>[1],
        'U-ADMIN',
      );

      expect(areaRepo.create).toHaveBeenCalledWith({
        workspaceId: 'W1',
        name: 'Sales',
        color: DEFAULT_AREA_COLOR,
        icon: null,
        description: null,
        createdBy: 'U-ADMIN',
        updatedBy: 'U-ADMIN',
      });
      expect(result).toBe(created);
    });

    it('throws ConflictException("AREA_NAME_TAKEN") when active duplicate exists', async () => {
      areaRepo.findOne.mockResolvedValueOnce(makeArea({ name: 'Sales' }));

      await expect(
        service.create(
          'W1',
          { name: 'Sales', color: '#000000' } as Parameters<
            typeof service.create
          >[1],
          'U-ADMIN',
        ),
      ).rejects.toThrow(ConflictException);
      expect(areaRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────
  describe('update()', () => {
    it('partially updates color/icon/description without touching the name', async () => {
      const existing = makeArea();
      areaRepo.findOne.mockResolvedValueOnce(existing); // get()
      areaRepo.save.mockImplementation(async (e: AreaEntity) => e);

      const result = await service.update('A1', 'W1', {
        color: '#0000ff',
        icon: 'pi-briefcase',
        description: 'desc',
      });

      expect(result.color).toBe('#0000ff');
      expect(result.icon).toBe('pi-briefcase');
      expect(result.description).toBe('desc');
      expect(result.name).toBe('Engineering');
      // name was never compared → no second findOne call for uniqueness
      expect(areaRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('runs uniqueness check only when name actually changes', async () => {
      const existing = makeArea({ name: 'Engineering' });
      areaRepo.findOne
        .mockResolvedValueOnce(existing) // get()
        .mockResolvedValueOnce(null); // assertNameAvailable
      areaRepo.save.mockImplementation(async (e: AreaEntity) => e);

      const result = await service.update('A1', 'W1', { name: 'Eng' });

      expect(result.name).toBe('Eng');
      expect(areaRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('skips uniqueness check when name is identical to current', async () => {
      const existing = makeArea({ name: 'Engineering' });
      areaRepo.findOne.mockResolvedValueOnce(existing); // get()
      areaRepo.save.mockImplementation(async (e: AreaEntity) => e);

      await service.update('A1', 'W1', { name: 'Engineering' });

      expect(areaRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when renaming to a taken name', async () => {
      const existing = makeArea({ name: 'Engineering' });
      const collide = makeArea({ id: 'A2', name: 'Design' });
      areaRepo.findOne
        .mockResolvedValueOnce(existing) // get()
        .mockResolvedValueOnce(collide); // assertNameAvailable

      await expect(
        service.update('A1', 'W1', { name: 'Design' }),
      ).rejects.toThrow(ConflictException);
      expect(areaRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the area does not exist', async () => {
      areaRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.update('A1', 'W1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── softDelete ───────────────────────────────────────────────────────────
  describe('softDelete()', () => {
    it('nullifies references on users and projects, then soft-deletes — all in one transaction', async () => {
      const area = makeArea({ id: 'A1' });
      areaRepo.findOne.mockResolvedValueOnce(area);

      await service.softDelete('A1', 'W1');

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // users.areaId nullified for every user that referenced this area
      expect(entityManager.update).toHaveBeenCalledWith(
        UserEntity,
        { areaId: 'A1' },
        { areaId: null },
      );
      // projects.areaId nullified, but ONLY within the same workspace
      expect(entityManager.update).toHaveBeenCalledWith(
        ProjectEntity,
        { workspaceId: 'W1', areaId: 'A1' },
        { areaId: null },
      );
      // and finally the area is soft-deleted
      expect(entityManager.softDelete).toHaveBeenCalledWith(AreaEntity, {
        id: 'A1',
      });

      // order is important: users/projects must be nullified BEFORE the area
      // is soft-deleted (defensive — if it ever flipped, an outer query that
      // joined on areas could see deleted-but-still-referenced state).
      const updateOrder = entityManager.update.mock.invocationCallOrder;
      const deleteOrder = entityManager.softDelete.mock.invocationCallOrder;
      expect(Math.max(...updateOrder)).toBeLessThan(deleteOrder[0]!);
    });

    it('throws NotFoundException without touching users/projects when area is missing', async () => {
      areaRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.softDelete('A1', 'W1')).rejects.toThrow(
        NotFoundException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(entityManager.update).not.toHaveBeenCalled();
      expect(entityManager.softDelete).not.toHaveBeenCalled();
    });
  });
});
