import { NotImplementedException } from '@nestjs/common';
import {
  ISearchEngine,
  SearchEntityType,
  SearchQuery,
  SearchResult,
} from '../search-engine.interface';

const NOT_IMPLEMENTED_MSG =
  'Elasticsearch engine not implemented; set SEARCH_ENGINE=pg';

/**
 * Stub implementation of ISearchEngine for Elasticsearch.
 * Every method throws NotImplementedException so callers get a clear signal.
 * The module factory only instantiates this when SEARCH_ENGINE=elasticsearch,
 * so it never throws at application boot for the default pg configuration.
 */
export class ElasticsearchEngine implements ISearchEngine {
  async upsert(_doc: {
    workspaceId: string;
    entityType: SearchEntityType;
    entityId: string;
    content: string;
    occurredAt?: Date;
    parentType?: SearchEntityType | null;
    parentId?: string | null;
  }): Promise<void> {
    throw new NotImplementedException(NOT_IMPLEMENTED_MSG);
  }

  async delete(
    _workspaceId: string,
    _entityType: SearchEntityType,
    _entityId: string,
  ): Promise<void> {
    throw new NotImplementedException(NOT_IMPLEMENTED_MSG);
  }

  async search(_q: SearchQuery): Promise<SearchResult> {
    throw new NotImplementedException(NOT_IMPLEMENTED_MSG);
  }
}
