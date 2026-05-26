/**
 * Compile-time contract test: verifies PgFullTextSearchEngine and
 * ElasticsearchEngine satisfy ISearchEngine at the TypeScript level.
 * This file only imports types — it has zero runtime assertions intentionally.
 * The presence of this file + a successful compile proves the interface contract.
 */
import type { ISearchEngine } from './search-engine.interface';
import type { PgFullTextSearchEngine } from './engines/pg-full-text-search.engine';
import type { ElasticsearchEngine } from './engines/elasticsearch.engine.stub';

// TypeScript assignment — fails to compile if shape doesn't match

const _pg: ISearchEngine = null as unknown as PgFullTextSearchEngine;

const _es: ISearchEngine = null as unknown as ElasticsearchEngine;

describe('ISearchEngine contract (compile-time)', () => {
  it('PgFullTextSearchEngine satisfies ISearchEngine', () => {
    // The fact that this file compiled is the assertion.
    expect(true).toBe(true);
  });

  it('ElasticsearchEngine satisfies ISearchEngine', () => {
    expect(true).toBe(true);
  });
});
