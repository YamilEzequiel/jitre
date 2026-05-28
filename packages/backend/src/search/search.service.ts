import { Injectable, Inject } from '@nestjs/common';
import {
  SEARCH_ENGINE,
  ISearchEngine,
  SearchEntityType,
  SearchQuery,
  SearchResult,
} from './search-engine.interface';

/**
 * Thin facade that delegates to the bound ISearchEngine.
 * Engine selection (pg vs elasticsearch) happens in SearchModule via factory.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(SEARCH_ENGINE) private readonly engine: ISearchEngine) {}

  search(q: SearchQuery): Promise<SearchResult> {
    return this.engine.search(q);
  }

  upsert(doc: {
    workspaceId: string;
    entityType: SearchEntityType;
    entityId: string;
    content: string;
    occurredAt?: Date;
    parentType?: SearchEntityType | null;
    parentId?: string | null;
  }): Promise<void> {
    return this.engine.upsert(doc);
  }

  delete(
    workspaceId: string,
    entityType: SearchEntityType,
    entityId: string,
  ): Promise<void> {
    return this.engine.delete(workspaceId, entityType, entityId);
  }
}
