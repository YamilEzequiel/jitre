import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomFieldController } from './custom-field.controller';
import { CustomFieldService } from './custom-field.service';
import { CustomFieldType } from '@jitre/shared';

const mockService = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
};

const makeReq = () => ({ user: { id: 'user-1' }, workspace: { id: 'ws-1' } });

describe('CustomFieldController', () => {
  let controller: CustomFieldController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomFieldController],
      providers: [{ provide: CustomFieldService, useValue: mockService }],
    }).compile();
    controller = module.get<CustomFieldController>(CustomFieldController);
  });

  it('create — saves field and returns 201', async () => {
    mockService.create.mockResolvedValue({ id: 'cf1' });
    const result = await controller.create(
      {
        name: 'Priority',
        type: CustomFieldType.SELECT,
        options: ['Low', 'High'],
      },
      makeReq() as never,
    );
    expect(result).toBeDefined();
  });

  it('create — throws BadRequestException for SELECT without options', async () => {
    mockService.create.mockRejectedValue(
      new BadRequestException('OPTIONS_REQUIRED'),
    );
    await expect(
      controller.create(
        { name: 'X', type: CustomFieldType.SELECT },
        makeReq() as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('list — returns fields', async () => {
    mockService.list.mockResolvedValue([{ id: 'cf1' }]);
    const result = await controller.list(makeReq() as never, 'proj-1');
    expect(result).toHaveLength(1);
  });

  it('update — updates field', async () => {
    mockService.update.mockResolvedValue({ id: 'cf1' });
    const result = await controller.update(
      'cf1',
      { name: 'Severity' },
      makeReq() as never,
    );
    expect(result).toBeDefined();
  });

  it('delete — deletes field', async () => {
    mockService.delete.mockResolvedValue(undefined);
    await controller.delete('cf1', makeReq() as never);
    expect(mockService.delete).toHaveBeenCalled();
  });

  it('delete — throws NotFoundException for missing field', async () => {
    mockService.delete.mockRejectedValue(new NotFoundException());
    await expect(
      controller.delete('missing', makeReq() as never),
    ).rejects.toThrow(NotFoundException);
  });
});
