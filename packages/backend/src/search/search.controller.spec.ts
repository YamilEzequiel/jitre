import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SEARCH_ENGINE } from './search-engine.interface';
import { SearchQueryDto } from './dto/search-query.dto';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: jest.Mocked<Pick<SearchService, 'search'>>;

  const hitsMock = {
    items: [
      {
        entityType: 'comment',
        entityId: 'C1',
        workspaceId: 'W1',
        rank: 0.8,
        snippet: 'hello world',
        occurredAt: new Date(),
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  };

  beforeEach(async () => {
    searchService = { search: jest.fn().mockResolvedValue(hitsMock) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: searchService },
        { provide: SEARCH_ENGINE, useValue: {} },
      ],
    }).compile();

    controller = module.get(SearchController);
  });

  it('returns workspace-scoped search hits', async () => {
    const result = await controller.search({
      workspaceId: 'W1',
      q: 'hello',
      page: 1,
      pageSize: 20,
    });
    expect(result.items).toHaveLength(1);
    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'W1', query: 'hello' }),
    );
  });

  describe('SearchQueryDto validation', () => {
    it('rejects empty q string', async () => {
      const dto = plainToInstance(SearchQueryDto, {
        workspaceId: 'aad0c2d4-6f07-42c9-ba31-3f92b3b8d000',
        q: '',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const qError = errors.find((e) => e.property === 'q');
      expect(qError).toBeDefined();
    });

    it('rejects q longer than 200 chars', async () => {
      const dto = plainToInstance(SearchQueryDto, {
        workspaceId: 'aad0c2d4-6f07-42c9-ba31-3f92b3b8d000',
        q: 'a'.repeat(201),
      });
      const errors = await validate(dto);
      const qError = errors.find((e) => e.property === 'q');
      expect(qError).toBeDefined();
    });

    it('accepts valid dto', async () => {
      const dto = plainToInstance(SearchQueryDto, {
        workspaceId: 'aad0c2d4-6f07-42c9-ba31-3f92b3b8d000',
        q: 'hello',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts document as a searchable entity type', async () => {
      const dto = plainToInstance(SearchQueryDto, {
        workspaceId: 'aad0c2d4-6f07-42c9-ba31-3f92b3b8d000',
        q: 'runbook',
        type: 'document',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
