export interface IPaginationParams {
  page: number;
  pageSize: number;
}

export interface IPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface IPaginatedResult<T> {
  items: T[];
  meta: IPaginationMeta;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;
