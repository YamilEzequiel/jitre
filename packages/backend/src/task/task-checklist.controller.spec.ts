import { Test, TestingModule } from '@nestjs/testing';
import { TaskChecklistController } from './task-checklist.controller';
import { TaskChecklistService } from './task-checklist.service';
import { TaskChecklistItemStatus } from '@jitre/shared';

const mockService = {
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  setStatus: jest.fn(),
  reorder: jest.fn(),
  remove: jest.fn(),
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-1' },
  workspace: { id: 'ws-1' },
  ...overrides,
});

describe('TaskChecklistController', () => {
  let controller: TaskChecklistController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskChecklistController],
      providers: [{ provide: TaskChecklistService, useValue: mockService }],
    }).compile();
    controller = module.get(TaskChecklistController);
  });

  it('GET — lists items', async () => {
    mockService.list.mockResolvedValue([{ id: 'i1' }]);

    const result = await controller.list('task-1', makeReq() as never);

    expect(mockService.list).toHaveBeenCalledWith('task-1', 'ws-1');
    expect(result).toEqual([{ id: 'i1' }]);
  });

  it('POST — creates item with workspace from request', async () => {
    mockService.create.mockResolvedValue({ id: 'i1' });

    await controller.create(
      'task-1',
      { content: 'crit' },
      makeReq() as never,
    );

    expect(mockService.create).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      taskId: 'task-1',
      content: 'crit',
      order: undefined,
    });
  });

  it('PATCH — updates content', async () => {
    mockService.update.mockResolvedValue({ id: 'i1', content: 'new' });

    await controller.update(
      'task-1',
      'i1',
      { content: 'new' },
      makeReq() as never,
    );

    expect(mockService.update).toHaveBeenCalledWith('i1', 'ws-1', {
      content: 'new',
    });
  });

  it('PATCH status — forwards actor for trazabilidad', async () => {
    mockService.setStatus.mockResolvedValue({ id: 'i1' });

    await controller.setStatus(
      'task-1',
      'i1',
      { status: TaskChecklistItemStatus.PASSED },
      makeReq() as never,
    );

    expect(mockService.setStatus).toHaveBeenCalledWith(
      'i1',
      'ws-1',
      'user-1',
      TaskChecklistItemStatus.PASSED,
    );
  });

  it('POST reorder — passes orderedIds', async () => {
    mockService.reorder.mockResolvedValue(undefined);

    await controller.reorder(
      'task-1',
      { orderedIds: ['a', 'b'] },
      makeReq() as never,
    );

    expect(mockService.reorder).toHaveBeenCalledWith('task-1', 'ws-1', [
      'a',
      'b',
    ]);
  });

  it('DELETE — soft removes item', async () => {
    mockService.remove.mockResolvedValue(undefined);

    await controller.remove('task-1', 'i1', makeReq() as never);

    expect(mockService.remove).toHaveBeenCalledWith('i1', 'ws-1');
  });
});
