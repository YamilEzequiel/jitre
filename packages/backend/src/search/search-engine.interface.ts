export const SEARCH_ENGINE = Symbol('SEARCH_ENGINE');

export type SearchEntityType =
  | 'comment'
  | 'workspace'
  | 'user'
  | 'task'
  | 'project'
  | 'document';

export interface SearchHit {
  entityType: SearchEntityType;
  entityId: string;
  workspaceId: string;
  rank: number;
  snippet: string;
  occurredAt: Date;
}

export interface SearchQuery {
  workspaceId: string;
  query: string;
  entityType?: SearchEntityType;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ISearchEngine {
  upsert(doc: {
    workspaceId: string;
    entityType: SearchEntityType;
    entityId: string;
    content: string;
    occurredAt?: Date;
  }): Promise<void>;

  delete(
    workspaceId: string,
    entityType: SearchEntityType,
    entityId: string,
  ): Promise<void>;

  search(q: SearchQuery): Promise<SearchResult>;
}
