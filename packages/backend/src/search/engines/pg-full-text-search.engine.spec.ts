import { PgFullTextSearchEngine } from './pg-full-text-search.engine';
import { SearchDocument } from '../search-document.entity';

describe('PgFullTextSearchEngine', () => {
  let engine: PgFullTextSearchEngine;
  let mockRepo: {
    query: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(() => {
    mockRepo = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    engine = new PgFullTextSearchEngine(mockRepo as never);
  });

  describe('search()', () => {
    it('returns empty result immediately when query is empty string', async () => {
      const result = await engine.search({
        workspaceId: 'W1',
        query: '',
        page: 1,
        pageSize: 10,
      });
      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 10 });
      expect(mockRepo.query).not.toHaveBeenCalled();
    });

    it('returns empty result when query is whitespace only', async () => {
      const result = await engine.search({
        workspaceId: 'W1',
        query: '   ',
        page: 1,
        pageSize: 10,
      });
      expect(result.items).toHaveLength(0);
      expect(mockRepo.query).not.toHaveBeenCalled();
    });

    it('executes SQL with workspaceId and query params', async () => {
      mockRepo.query
        .mockResolvedValueOnce([]) // hits
        .mockResolvedValueOnce([{ count: '0' }]); // count

      await engine.search({
        workspaceId: 'W1',
        query: 'hello',
        page: 1,
        pageSize: 10,
      });

      expect(mockRepo.query).toHaveBeenCalled();
      const firstCallSql = mockRepo.query.mock.calls[0][0] as string;
      expect(firstCallSql).toContain('plainto_tsquery');
      expect(firstCallSql).toContain('workspace_id');
    });

    it('passes entityType filter as 3rd parameter when provided', async () => {
      mockRepo.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }]);

      await engine.search({
        workspaceId: 'W1',
        query: 'test',
        entityType: 'comment',
        page: 1,
        pageSize: 10,
      });

      const params = mockRepo.query.mock.calls[0][1] as unknown[];
      expect(params).toContain('comment');
    });
  });

  describe('upsert()', () => {
    it('executes INSERT...ON CONFLICT SQL', async () => {
      await engine.upsert({
        workspaceId: 'W1',
        entityType: 'comment',
        entityId: 'C1',
        content: 'hello world',
      });
      expect(mockRepo.query).toHaveBeenCalled();
      const sql = mockRepo.query.mock.calls[0][0] as string;
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('to_tsvector');
    });
  });

  describe('delete()', () => {
    it('soft-deletes the matching SearchDocument row', async () => {
      mockRepo.softDelete.mockResolvedValue({ affected: 1 });

      await engine.delete('W1', 'comment', 'C1');

      expect(mockRepo.softDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'W1',
          entityType: 'comment',
          entityId: 'C1',
        }),
      );
    });
  });
});
