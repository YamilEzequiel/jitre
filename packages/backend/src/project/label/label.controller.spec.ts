import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LabelController } from './label.controller';
import { LabelService } from './label.service';
import { LabelScope } from '@jitre/shared';

const mockLabelService = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  listByWorkspace: jest.fn(),
  listByProject: jest.fn(),
};

const makeReq = () => ({ user: { id: 'user-1' }, workspace: { id: 'ws-1' } });

describe('LabelController', () => {
  let controller: LabelController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LabelController],
      providers: [{ provide: LabelService, useValue: mockLabelService }],
    }).compile();
    controller = module.get<LabelController>(LabelController);
  });

  it('create — saves label and returns 201', async () => {
    mockLabelService.create.mockResolvedValue({ id: 'l1' });
    const result = await controller.create(
      { name: 'Bug', scope: LabelScope.WORKSPACE },
      makeReq() as never,
    );
    expect(result).toBeDefined();
  });

  it('listByWorkspace — returns workspace labels', async () => {
    mockLabelService.listByWorkspace.mockResolvedValue([{ id: 'l1' }]);
    const result = await controller.listByWorkspace(makeReq() as never);
    expect(result).toHaveLength(1);
  });

  it('listByProject — returns project labels', async () => {
    mockLabelService.listByProject.mockResolvedValue([{ id: 'l2' }]);
    const result = await controller.listByProject('proj-1', makeReq() as never);
    expect(result).toHaveLength(1);
    expect(mockLabelService.listByProject).toHaveBeenCalledWith('proj-1', 'ws-1');
  });

  it('update — updates label', async () => {
    mockLabelService.update.mockResolvedValue({ id: 'l1', name: 'Feature' });
    const result = await controller.update(
      'l1',
      { name: 'Feature' },
      makeReq() as never,
    );
    expect(result).toBeDefined();
  });

  it('delete — deletes label', async () => {
    mockLabelService.delete.mockResolvedValue(undefined);
    await controller.delete('l1', makeReq() as never);
    expect(mockLabelService.delete).toHaveBeenCalled();
  });

  it('create with scope mismatch throws BadRequestException', async () => {
    mockLabelService.create.mockRejectedValue(
      new BadRequestException('SCOPE_MISMATCH'),
    );
    await expect(
      controller.create(
        { name: 'X', scope: LabelScope.PROJECT },
        makeReq() as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('update with missing label throws NotFoundException', async () => {
    mockLabelService.update.mockRejectedValue(new NotFoundException());
    await expect(
      controller.update('missing', { name: 'X' }, makeReq() as never),
    ).rejects.toThrow(NotFoundException);
  });
});
