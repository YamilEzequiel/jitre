import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { StatusCategory } from '@jitre/shared';

const mockStatusService = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  listByProject: jest.fn(),
  listByWorkspace: jest.fn(),
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-1' },
  workspace: { id: 'ws-1' },
  ...overrides,
});

describe('StatusController', () => {
  let controller: StatusController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusController],
      providers: [{ provide: StatusService, useValue: mockStatusService }],
    }).compile();

    controller = module.get<StatusController>(StatusController);
  });

  describe('create', () => {
    it('creates a status and returns 201', async () => {
      const status = { id: 's1', name: 'To Do', category: StatusCategory.TODO };
      mockStatusService.create.mockResolvedValue(status);

      const result = await controller.create(
        'proj-1',
        { name: 'To Do', category: StatusCategory.TODO },
        makeReq() as never,
      );
      expect(result).toEqual(status);
    });
  });

  describe('listByProject', () => {
    it('returns statuses for project', async () => {
      const statuses = [{ id: 's1' }];
      mockStatusService.listByProject.mockResolvedValue(statuses);

      const result = await controller.listByProject(
        'proj-1',
        makeReq() as never,
      );
      expect(result).toEqual(statuses);
    });
  });

  describe('update', () => {
    it('updates a status', async () => {
      const updated = { id: 's1', name: 'Updated' };
      mockStatusService.update.mockResolvedValue(updated);

      const result = await controller.update(
        's1',
        { name: 'Updated' },
        makeReq() as never,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('deletes a status with replaceWithStatusId', async () => {
      mockStatusService.delete.mockResolvedValue(undefined);

      await controller.delete(
        's1',
        { replaceWithStatusId: 's2' },
        makeReq() as never,
      );
      expect(mockStatusService.delete).toHaveBeenCalledWith(
        's1',
        'ws-1',
        expect.objectContaining({ replaceWithStatusId: 's2' }),
      );
    });

    it('throws BadRequestException without replaceWithStatusId when tasks reference it', async () => {
      mockStatusService.delete.mockRejectedValue(
        new BadRequestException('REPLACE_STATUS_REQUIRED'),
      );

      await expect(
        controller.delete('s1', {}, makeReq() as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when status not found', async () => {
      mockStatusService.delete.mockRejectedValue(new NotFoundException());

      await expect(
        controller.delete('missing', {}, makeReq() as never),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
