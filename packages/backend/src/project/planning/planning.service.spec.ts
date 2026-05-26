import { NotFoundException } from '@nestjs/common';
import { PlanningService } from './planning.service';

describe('PlanningService', () => {
  const repo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    softDelete: jest.fn(),
  };
  let service: PlanningService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlanningService(repo as never);
  });

  it('creates persisted epics, sprints or releases', async () => {
    const item = { id: 'e1', type: 'epic', name: 'Platform' };
    repo.create.mockReturnValue(item);
    repo.save.mockResolvedValue(item);

    await expect(
      service.create({
        workspaceId: 'ws1',
        projectId: 'p1',
        type: 'epic',
        name: 'Platform',
      }),
    ).resolves.toEqual(item);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'p1', type: 'epic', status: 'planned' }),
    );
  });

  it('does not update an item outside the requested project', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.update('e1', 'p2', 'ws1', { name: 'Wrong project' })).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'e1', projectId: 'p2', workspaceId: 'ws1' } });
  });
});
