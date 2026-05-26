import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { SEARCH_ENGINE } from './search-engine.interface';

describe('SearchService', () => {
  let service: SearchService;
  let mockEngine: {
    search: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    mockEngine = {
      search: jest
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: SEARCH_ENGINE, useValue: mockEngine },
      ],
    }).compile();

    service = module.get(SearchService);
  });

  it('search delegates 1:1 to engine', async () => {
    const q = { workspaceId: 'W1', query: 'hello' };
    await service.search(q);
    expect(mockEngine.search).toHaveBeenCalledWith(q);
  });

  it('upsert delegates 1:1 to engine', async () => {
    const doc = {
      workspaceId: 'W1',
      entityType: 'comment' as const,
      entityId: 'C1',
      content: 'x',
    };
    await service.upsert(doc);
    expect(mockEngine.upsert).toHaveBeenCalledWith(doc);
  });

  it('delete delegates 1:1 to engine', async () => {
    await service.delete('W1', 'comment', 'C1');
    expect(mockEngine.delete).toHaveBeenCalledWith('W1', 'comment', 'C1');
  });
});
