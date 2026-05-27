import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole } from '@jitre/shared';
import { AreaController } from './area.controller';
import { AreaService } from './area.service';

const mockService = {
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

function makeReq(overrides: Record<string, unknown> = {}): unknown {
  return {
    user: { id: 'U-ADMIN' },
    workspace: { id: 'W1', role: WorkspaceRole.ADMIN },
    ...overrides,
  };
}

describe('AreaController', () => {
  let controller: AreaController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AreaController],
      providers: [{ provide: AreaService, useValue: mockService }],
    }).compile();
    controller = module.get(AreaController);
  });

  describe('list() — GET /workspaces/:workspaceId/areas', () => {
    it('delegates to service when workspace matches', async () => {
      const areas = [{ id: 'A1', name: 'Engineering' }];
      mockService.list.mockResolvedValueOnce(areas);

      const result = await controller.list(
        'W1',
        makeReq() as Parameters<typeof controller.list>[1],
      );

      expect(mockService.list).toHaveBeenCalledWith('W1');
      expect(result).toBe(areas);
    });

    it('throws ForbiddenException on workspace mismatch', async () => {
      await expect(
        controller.list(
          'W-OTHER',
          makeReq() as Parameters<typeof controller.list>[1],
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockService.list).not.toHaveBeenCalled();
    });
  });

  describe('create() — POST /workspaces/:workspaceId/areas', () => {
    it('delegates to service with workspace, dto and actor id', async () => {
      const created = { id: 'A1', name: 'Engineering' };
      mockService.create.mockResolvedValueOnce(created);

      const result = await controller.create(
        'W1',
        { name: 'Engineering', color: '#7c3aed' } as Parameters<
          typeof controller.create
        >[1],
        makeReq() as Parameters<typeof controller.create>[2],
      );

      expect(mockService.create).toHaveBeenCalledWith(
        'W1',
        { name: 'Engineering', color: '#7c3aed' },
        'U-ADMIN',
      );
      expect(result).toBe(created);
    });

    it('throws ForbiddenException on workspace mismatch', async () => {
      await expect(
        controller.create(
          'W-OTHER',
          { name: 'X' } as Parameters<typeof controller.create>[1],
          makeReq() as Parameters<typeof controller.create>[2],
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockService.create).not.toHaveBeenCalled();
    });
  });

  describe('update() — PATCH /workspaces/:workspaceId/areas/:id', () => {
    it('delegates to service with id, workspace and dto', async () => {
      const updated = { id: 'A1', name: 'New' };
      mockService.update.mockResolvedValueOnce(updated);

      const result = await controller.update(
        'W1',
        'A1',
        { name: 'New' } as Parameters<typeof controller.update>[2],
        makeReq() as Parameters<typeof controller.update>[3],
      );

      expect(mockService.update).toHaveBeenCalledWith('A1', 'W1', {
        name: 'New',
      });
      expect(result).toBe(updated);
    });

    it('throws ForbiddenException on workspace mismatch', async () => {
      await expect(
        controller.update(
          'W-OTHER',
          'A1',
          {} as Parameters<typeof controller.update>[2],
          makeReq() as Parameters<typeof controller.update>[3],
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockService.update).not.toHaveBeenCalled();
    });
  });

  describe('remove() — DELETE /workspaces/:workspaceId/areas/:id', () => {
    it('delegates to service.softDelete', async () => {
      mockService.softDelete.mockResolvedValueOnce(undefined);

      await controller.remove(
        'W1',
        'A1',
        makeReq() as Parameters<typeof controller.remove>[2],
      );

      expect(mockService.softDelete).toHaveBeenCalledWith('A1', 'W1');
    });

    it('throws ForbiddenException on workspace mismatch', async () => {
      await expect(
        controller.remove(
          'W-OTHER',
          'A1',
          makeReq() as Parameters<typeof controller.remove>[2],
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockService.softDelete).not.toHaveBeenCalled();
    });
  });
});
